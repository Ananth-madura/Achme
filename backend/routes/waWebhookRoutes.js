const express = require("express");
const router = express.Router();
const db = require("../config/database");
const wa = require("../services/whatsappCloudApi");

router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const result = wa.verifyWebhook(mode, token, challenge);
  if (result) {
    return res.status(200).send(result);
  }
  res.sendStatus(403);
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;

    await db.promise().query(
      "INSERT INTO wa_webhook_events (event_type, payload) VALUES (?, ?)",
      ["webhook_received", JSON.stringify(body)]
    );

    if (body.entry) {
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "messages") {
              const value = change.value;
              if (value.messages) {
                for (const msg of value.messages) {
                  await handleIncomingMessage(msg, value.metadata);
                }
              }
              if (value.statuses) {
                for (const status of value.statuses) {
                  await handleStatusUpdate(status);
                }
              }
            }
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.sendStatus(200);
  }
});

async function handleIncomingMessage(msg, metadata) {
  const phone = msg.from;
  const msgId = msg.id;
  const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

  let messageText = "";
  let messageType = "text";

  if (msg.type === "text") {
    messageText = msg.text.body;
  } else if (msg.type === "interactive") {
    messageType = "interactive";
    messageText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "";
  } else {
    messageType = msg.type;
    messageText = msg[msg.type]?.caption || msg[msg.type]?.id || "";
  }

  await db.promise().query(
    `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, wa_message_id, status, metadata, created_at) VALUES (?, 'inbound', ?, ?, ?, 'delivered', ?, ?)`,
    [phone, messageType, messageText, msgId, JSON.stringify(msg), timestamp]
  );

  await db.promise().query(
    "INSERT INTO wa_webhook_events (event_type, wa_message_id, phone, status, payload) VALUES (?, ?, ?, ?, ?)",
    ["incoming_message", msgId, phone, "received", JSON.stringify(msg)]
  );
}

async function handleStatusUpdate(status) {
  const msgId = status.id;
  const statusName = status.status;
  const phone = status.recipient_id;
  const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();
  const conversation = status.conversation || null;

  let statusColumn = "";
  if (statusName === "sent") statusColumn = "sent_at";
  else if (statusName === "delivered") statusColumn = "delivered_at";
  else if (statusName === "read") statusColumn = "read_at";
  else if (statusName === "failed") statusColumn = "sent_at";

  if (statusColumn) {
    const updateFields = [`status = '${statusName}'`, `${statusColumn} = ?`];
    if (statusName === "failed") {
      updateFields.push(`error = ?`);
    }

    await db.promise().query(
      `UPDATE wa_message_logs SET ${updateFields.join(", ")} WHERE wa_message_id = ?`,
      statusName === "failed" ? [status.errors?.[0]?.message || "Unknown error", msgId] : [timestamp, msgId]
    );

    await db.promise().query(
      `UPDATE wa_campaign_messages SET status = ?, ${statusColumn} = ? ${statusName === "failed" ? ", error = ?" : ""} WHERE wa_message_id = ?`,
      statusName === "failed" ? [statusName, timestamp, status.errors?.[0]?.message || "Unknown error", msgId] : [statusName, timestamp, msgId]
    );

    if (statusName === "delivered" || statusName === "read") {
      const [rows] = await db.promise().query("SELECT campaign_id FROM wa_campaign_messages WHERE wa_message_id = ?", [msgId]);
      if (rows.length) {
        const col = statusName === "delivered" ? "delivered_count" : "read_count";
        await db.promise().query(`UPDATE wa_campaigns SET ${col} = ${col} + 1 WHERE id = ?`, [rows[0].campaign_id]);
      }
    }
  }

  await db.promise().query(
    "INSERT INTO wa_webhook_events (event_type, wa_message_id, phone, status, payload) VALUES (?, ?, ?, ?, ?)",
    ["status_update", msgId, phone, statusName, JSON.stringify(status)]
  );
}

module.exports = router;