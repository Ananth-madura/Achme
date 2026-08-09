const db = require("../config/database");
let redisAvailable = false;
let messageQueue = null;

// Only attempt Redis connection if explicitly enabled or REDIS_URL is provided in environment
const USE_REDIS = process.env.USE_REDIS === "true" || !!process.env.REDIS_URL;

if (USE_REDIS) {
  try {
    const IORedis = require("ioredis");
    const { Queue } = require("bullmq");
    const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

    const connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy: () => null, // Do not continuously retry if server is offline
      enableOfflineQueue: false,
      showFriendlyErrorStack: false,
      connectTimeout: 1000,
      lazyConnect: true,
    });

    // Suppress unhandled ioredis ECONNREFUSED error events
    connection.on("error", () => {
      redisAvailable = false;
    });

    // Gracefully test connection without emitting uncaught AggregateError
    connection
      .connect()
      .then(() => connection.ping())
      .then(() => {
        redisAvailable = true;
        messageQueue = new Queue("whatsapp-messages", { connection });
        console.log("✅ Redis connected successfully — using BullMQ message queue.");
      })
      .catch(() => {
        redisAvailable = false;
        try { connection.disconnect(); } catch (_) {}
      });
  } catch (e) {
    redisAvailable = false;
  }
}

async function startWorker() {
  if (!redisAvailable || !messageQueue) {
    console.log("Redis not available — using in-memory queue (messages process synchronously)");
    return;
  }
  try {
    const { Worker: BWorker } = require("bullmq");
    new BWorker(
      "whatsapp-messages",
      async (job) => {
        const { campaignId, contactId, phone, message, templateName, templateComponents } = job.data;
        await processSingleMessage(campaignId, contactId, phone, message, templateName, templateComponents);
      },
      { connection: messageQueue?.connection, concurrency: 5, limiter: { max: 10, duration: 1000 } }
    );
    console.log("BullMQ worker started");
  } catch (e) {
    console.log("BullMQ worker failed to start:", e.message);
  }
}

async function processSingleMessage(campaignId, contactId, phone, message, templateName, templateComponents) {
  const waCloud = require("./whatsappCloudApi");
  const waWeb = require("./whatsappService");
  try {
    let result;
    if (waCloud.isConfigured()) {
      if (templateName) {
        result = await waCloud.sendTemplate(phone, templateName, "en", templateComponents || []);
      } else {
        result = await waCloud.sendText(phone, message);
      }
    } else if (waWeb.ready) {
      const formattedPhone = phone.includes("@c.us") ? phone : `${phone.replace(/\D/g, "")}@c.us`;
      result = await waWeb.sendMessage(formattedPhone, message);
    } else {
      throw new Error("Neither Meta Cloud API nor WhatsApp Web linked session is ready.");
    }

    const msgId = result?.messages?.[0]?.id || result?.id?._serialized || "sent_" + Date.now();

    await db.promise().query(
      `UPDATE wa_campaign_messages SET status = 'sent', wa_message_id = ?, sent_at = NOW() WHERE id = ?`,
      [msgId, contactId]
    );
    await db.promise().query(
      `UPDATE wa_message_logs SET status = 'sent', wa_message_id = ?, metadata = ? WHERE campaign_message_id = ?`,
      [msgId, JSON.stringify(result || {}), contactId]
    );
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    await db.promise().query(
      `UPDATE wa_campaign_messages SET status = 'failed', error = ?, sent_at = NOW() WHERE id = ?`,
      [errorMsg, contactId]
    );
    await db.promise().query(
      `UPDATE wa_message_logs SET status = 'failed', error = ? WHERE campaign_message_id = ?`,
      [errorMsg, contactId]
    );
  }

  await db.promise().query(
    `UPDATE wa_campaigns SET sent_count = (SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = ? AND status = 'sent'), failed_count = (SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = ? AND status = 'failed') WHERE id = ?`,
    [campaignId, campaignId, campaignId]
  );
}

async function addBulkMessages(campaignId, messages, delayMs = 0, customIntervalMs = 7000) {
  const interval = Number(customIntervalMs || process.env.WA_MESSAGE_INTERVAL || 7000); // 7-second gap per message
  if (redisAvailable && messageQueue) {
    const jobs = messages.map((m, i) => ({
      name: `campaign-${campaignId}`,
      data: { ...m, campaignId },
      opts: { delay: delayMs + i * interval },
    }));
    return messageQueue.addBulk(jobs);
  }

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (delayMs || i > 0) {
      await new Promise((r) => setTimeout(r, i === 0 ? delayMs : interval));
    }
    await processSingleMessage(campaignId, m.contactId, m.phone, m.message, m.templateName, m.templateComponents);
  }
  return { success: true, count: messages.length };
}

async function addSingleMessage(data, delayMs = 0) {
  if (redisAvailable && messageQueue) {
    return messageQueue.add("single-message", data, { delay: delayMs });
  }
  if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  await processSingleMessage(data.campaignId, data.contactId, data.phone, data.message, data.templateName, data.templateComponents);
  return { success: true };
}

async function getQueueStats() {
  if (!redisAvailable || !messageQueue) {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, mode: "in-memory" };
  }
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      messageQueue.getWaitingCount(),
      messageQueue.getActiveCount(),
      messageQueue.getCompletedCount(),
      messageQueue.getFailedCount(),
      messageQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed, mode: "redis" };
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, mode: "redis-error" };
  }
}

async function getFailedJobs(limit = 50) {
  if (!redisAvailable || !messageQueue) return [];
  try {
    return messageQueue.getFailed(0, limit);
  } catch {
    return [];
  }
}

async function cleanQueue() {
  if (!redisAvailable || !messageQueue) return;
  try {
    await messageQueue.clean(0, 1000, "completed");
    await messageQueue.clean(0, 1000, "failed");
  } catch {}
}

module.exports = { messageQueue, startWorker, addBulkMessages, addSingleMessage, getQueueStats, getFailedJobs, cleanQueue };