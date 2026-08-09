const { Client, LocalAuth } = require("whatsapp-web.js");
const path = require("path");
const fs = require("fs");

function getExecutablePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidatePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  for (const p of candidatePaths) {
    if (p && fs.existsSync(p)) return p;
  }
  return undefined;
}

class WhatsAppService {
  constructor() {
    this.client = null;
    this.qrCode = null;
    this.ready = false;
    this.phone = null;
    this.isInitializing = false;
    this.qrCallbacks = [];
    this.chatsCache = [];
    this.messagesCache = {};
    this.lastChatsFetch = 0;
    this.chatsFetching = false;
  }

  async init(forceFresh = false) {
    if (this.client && !forceFresh && !this.isInitializing) return;
    if (this.isInitializing && !forceFresh) return;

    const sessionPath = path.join(__dirname, "../../whatsapp-session");
    if (forceFresh || (!this.ready && !this.qrCode && !this.isInitializing)) {
      try {
        if (this.client) {
          await this.client.destroy().catch(() => {});
          this.client = null;
        }
        if (fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
      } catch (_) {}
    }

    this.isInitializing = true;
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const initTimer = setTimeout(() => {
      if (this.isInitializing && !this.ready && !this.qrCode) {
        console.warn("⚠️ WhatsApp Client init watchdog timeout — resetting state");
        this.isInitializing = false;
        if (this.client) {
          this.client.destroy().catch(() => {});
          this.client = null;
        }
      }
    }, 30000);

    try {
      const execPath = getExecutablePath();
      if (execPath) {
        console.log(`ℹ️ WhatsApp Puppeteer using browser at: ${execPath}`);
      }

      const puppeteerOptions = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      };
      if (execPath) puppeteerOptions.executablePath = execPath;

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: sessionPath,
        }),
        puppeteer: puppeteerOptions,
      });

      this.client.on("qr", (qr) => {
        clearTimeout(initTimer);
        this.qrCode = qr;
        this.ready = false;
        this.isInitializing = false;
        console.log("✅ WhatsApp QR Code generated successfully!");
        this.qrCallbacks.forEach((cb) => cb(qr));
        this.qrCallbacks = [];
      });

      this.client.on("ready", () => {
        clearTimeout(initTimer);
        this.ready = true;
        this.qrCode = null;
        this.isInitializing = false;
        this.phone = this.client.info?.wid?.user || null;
        console.log("✅ WhatsApp Client is Ready!");
      });

      this.client.on("authenticated", () => {
        clearTimeout(initTimer);
        this.qrCode = null;
      });

      this.client.on("auth_failure", () => {
        clearTimeout(initTimer);
        this.ready = false;
        this.qrCode = null;
        this.isInitializing = false;
        this.client = null;
      });

      this.client.on("disconnected", (reason) => {
        clearTimeout(initTimer);
        this.ready = false;
        this.qrCode = null;
        this.phone = null;
        this.isInitializing = false;
        this.client = null;
        console.warn("⚠️ WhatsApp session disconnected:", reason);
        setTimeout(() => {
          if (!this.ready && !this.isInitializing) {
            console.log("🔄 Auto-reconnecting WhatsApp Web session in background...");
            this.init(false).catch(() => {});
          }
        }, 10000);
      });

      this.client.on("message", async (msg) => {
        const chatId = msg.from;
        if (!this.messagesCache[chatId]) this.messagesCache[chatId] = [];
        this.messagesCache[chatId].unshift({
          id: msg.id.id,
          from: msg.from,
          to: msg.to,
          body: msg.body,
          timestamp: msg.timestamp,
          isMe: false,
        });
        if (this.messagesCache[chatId].length > 200) {
          this.messagesCache[chatId].length = 200;
        }
      });

      await this.client.initialize();
    } catch (err) {
      this.isInitializing = false;
      this.client = null;
      throw err;
    }
  }

  getStatus() {
    return {
      connected: this.ready,
      phone: this.phone || null,
      initializing: this.isInitializing,
      hasQr: !!this.qrCode,
    };
  }

  getUnifiedStatus() {
    const waCloud = require("./whatsappCloudApi");
    const cloudConfigured = waCloud.isConfigured();
    const webConnected = this.ready;

    let activeEngine = "Disconnected";
    if (cloudConfigured && webConnected) activeEngine = "Dual (Cloud API + Web)";
    else if (cloudConfigured) activeEngine = "Meta Cloud API";
    else if (webConnected) activeEngine = "WhatsApp Web Session";

    return {
      connected: cloudConfigured || webConnected,
      activeEngine,
      web: {
        connected: webConnected,
        phone: this.phone || null,
        initializing: this.isInitializing,
        hasQr: !!this.qrCode,
      },
      cloud: waCloud.getConfig(),
    };
  }

  async sendTestMessage(targetPhone, text = "Hello! This is a test message from ACHME CRM WhatsApp Engine.") {
    const waCloud = require("./whatsappCloudApi");
    const formattedPhone = targetPhone.replace(/\D/g, "");
    if (!formattedPhone) throw new Error("Valid phone number required");

    if (waCloud.isConfigured()) {
      const res = await waCloud.sendText(formattedPhone, text);
      return { success: true, engineUsed: "Meta Cloud API", response: res };
    } else if (this.ready) {
      const chatId = `${formattedPhone}@c.us`;
      const res = await this.sendMessage(chatId, text);
      return { success: true, engineUsed: "WhatsApp Web Session", response: res };
    } else {
      throw new Error("No active WhatsApp engine available. Please scan QR Code or configure Cloud API.");
    }
  }

  async getPairingCode(phone) {
    if (!phone) throw new Error("Phone number is required");
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) throw new Error("Please enter a valid phone number with country code (e.g. 919876543210)");

    if (!this.client || (!this.isInitializing && !this.ready)) {
      await this.init(true);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Pairing code generation timed out. Please try QR Code instead.")), 35000);
      const interval = setInterval(async () => {
        try {
          if (this.client && typeof this.client.requestPairingCode === "function") {
            clearInterval(interval);
            clearTimeout(timer);
            const code = await this.client.requestPairingCode(cleanPhone);
            console.log("✅ WhatsApp Pairing Code generated:", code);
            resolve(code);
          }
        } catch (e) {
          clearInterval(interval);
          clearTimeout(timer);
          reject(e);
        }
      }, 500);
    });
  }

  async getQr(timeout = 45000) {
    if (this.qrCode) return this.qrCode;

    if (!this.client || (!this.isInitializing && !this.ready)) {
      this.init(true).catch(() => {});
    }

    return new Promise((resolve, reject) => {
      const checkTimer = setInterval(() => {
        if (this.qrCode) {
          clearInterval(checkTimer);
          clearTimeout(timeoutTimer);
          return resolve(this.qrCode);
        }
      }, 300);

      const timeoutTimer = setTimeout(() => {
        clearInterval(checkTimer);
        const idx = this.qrCallbacks.indexOf(resolve);
        if (idx !== -1) this.qrCallbacks.splice(idx, 1);
        reject(new Error("QR code generation timed out. Please click Get QR Code to try again."));
      }, timeout);

      this.qrCallbacks.push((qr) => {
        clearInterval(checkTimer);
        clearTimeout(timeoutTimer);
        resolve(qr);
      });
    });
  }

  async getChats(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && now - this.lastChatsFetch < 4000 && this.chatsCache.length > 0) {
      return this.chatsCache;
    }
    if (this.chatsFetching && this.chatsCache.length > 0) return this.chatsCache;
    this.chatsFetching = true;

    const formattedChats = [];
    const seenPhones = new Set();

    if (this.ready && this.client) {
      try {
        let chats = await this.client.getChats().catch(() => []);
        if (!chats || chats.length === 0) {
          await new Promise((r) => setTimeout(r, 1000));
          chats = await this.client.getChats().catch(() => []);
        }

        (chats || []).forEach((c) => {
          const chatId = c.id._serialized;
          const cleanPhone = (c.id.user || "").replace(/\D/g, "").slice(-10);
          if (cleanPhone) seenPhones.add(cleanPhone);
          formattedChats.push({
            id: chatId,
            name: c.name || c.id.user || "Unknown",
            unreadCount: c.unreadCount || 0,
            timestamp: c.timestamp || Math.floor(Date.now() / 1000),
            lastMessage: c.lastMessage
              ? { body: c.lastMessage.body, timestamp: c.lastMessage.timestamp }
              : null,
          });
        });
      } catch (err) {
        console.error("WhatsApp Web fetch chats error:", err.message);
      }
    }

    const db = require("../config/database");
    try {
      // ── 1. Clients (all) ──────────────────────────────────────────
      const [clients] = await db.promise().query(
        "SELECT COALESCE(name, company_name, 'Client') as name, phone FROM clients WHERE phone IS NOT NULL AND phone != '' ORDER BY id DESC"
      );
      clients.forEach((c) => {
        const cleanPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
        if (cleanPhone.length === 10 && !seenPhones.has(cleanPhone)) {
          seenPhones.add(cleanPhone);
          formattedChats.push({ id: `91${cleanPhone}@c.us`, name: c.name, source: "Client", unreadCount: 0, timestamp: Math.floor(Date.now() / 1000), lastMessage: { body: "Client", timestamp: Math.floor(Date.now() / 1000) } });
        }
      });

      // ── 2. Telecalling leads (all) ────────────────────────────────
      const [telecalls] = await db.promise().query(
        "SELECT COALESCE(customer_name, company_name, 'Lead') as name, mobile_number as phone FROM telecalls WHERE mobile_number IS NOT NULL AND mobile_number != '' ORDER BY id DESC"
      );
      telecalls.forEach((c) => {
        const cleanPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
        if (cleanPhone.length === 10 && !seenPhones.has(cleanPhone)) {
          seenPhones.add(cleanPhone);
          formattedChats.push({ id: `91${cleanPhone}@c.us`, name: c.name, source: "Telecalling", unreadCount: 0, timestamp: Math.floor(Date.now() / 1000), lastMessage: { body: "Telecalling Lead", timestamp: Math.floor(Date.now() / 1000) } });
        }
      });

      // ── 3. Walkin leads (all) ─────────────────────────────────────
      const [walkins] = await db.promise().query(
        "SELECT COALESCE(customer_name, company_name, 'Walkin') as name, mobile_number as phone FROM walkins WHERE mobile_number IS NOT NULL AND mobile_number != '' ORDER BY id DESC"
      );
      walkins.forEach((c) => {
        const cleanPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
        if (cleanPhone.length === 10 && !seenPhones.has(cleanPhone)) {
          seenPhones.add(cleanPhone);
          formattedChats.push({ id: `91${cleanPhone}@c.us`, name: c.name, source: "Walkin", unreadCount: 0, timestamp: Math.floor(Date.now() / 1000), lastMessage: { body: "Walkin Lead", timestamp: Math.floor(Date.now() / 1000) } });
        }
      });

      // ── 4. Field visit leads (all) ────────────────────────────────
      const [fields] = await db.promise().query(
        "SELECT COALESCE(customer_name, company_name, 'Field') as name, mobile_number as phone FROM fields WHERE mobile_number IS NOT NULL AND mobile_number != '' ORDER BY id DESC"
      );
      fields.forEach((c) => {
        const cleanPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
        if (cleanPhone.length === 10 && !seenPhones.has(cleanPhone)) {
          seenPhones.add(cleanPhone);
          formattedChats.push({ id: `91${cleanPhone}@c.us`, name: c.name, source: "Field", unreadCount: 0, timestamp: Math.floor(Date.now() / 1000), lastMessage: { body: "Field Visit Lead", timestamp: Math.floor(Date.now() / 1000) } });
        }
      });

      console.log(`✅ WhatsApp contact list built: ${formattedChats.length} total (${seenPhones.size} unique phones)`);
    } catch (e) {
      console.error("CRM contacts load error:", e.message);
    }

    formattedChats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    this.chatsCache = formattedChats;
    this.lastChatsFetch = now;
    this.chatsFetching = false;
    return this.chatsCache;
  }

  async getMessages(chatId) {
    if (this.ready && this.client) {
      try {
        const chat = await this.client.getChatById(chatId);
        const msgs = await chat.fetchMessages({ limit: 100 });
        const formatted = msgs.map((m) => ({
          id: m.id.id,
          from: m.from,
          body: m.body,
          timestamp: m.timestamp,
          isMe: m.fromMe,
        }));
        this.messagesCache[chatId] = formatted;
        return formatted;
      } catch (err) {
        console.error("WhatsApp fetch messages error:", err.message);
        return this.messagesCache[chatId] || [];
      }
    }
    return this.messagesCache[chatId] || [];
  }

  async sendMessage(chatId, message) {
    const waCloud = require("./whatsappCloudApi");
    const cleanPhone = chatId.replace(/\D/g, "");

    if (this.ready && this.client) {
      const chat = await this.client.getChatById(chatId);
      const sent = await chat.sendMessage(message);
      if (!this.messagesCache[chatId]) this.messagesCache[chatId] = [];
      this.messagesCache[chatId].unshift({
        id: sent.id.id,
        from: sent.from,
        to: sent.to,
        body: message,
        timestamp: Math.floor(Date.now() / 1000),
        isMe: true,
      });
      return { success: true, id: sent.id.id };
    } else if (waCloud.isConfigured()) {
      const sent = await waCloud.sendText(cleanPhone, message);
      if (!this.messagesCache[chatId]) this.messagesCache[chatId] = [];
      this.messagesCache[chatId].unshift({
        id: sent?.messages?.[0]?.id || "sent_" + Date.now(),
        from: "me",
        to: cleanPhone,
        body: message,
        timestamp: Math.floor(Date.now() / 1000),
        isMe: true,
      });
      return { success: true, id: sent?.messages?.[0]?.id };
    } else {
      throw new Error("WhatsApp not connected. Please scan QR Code or configure Meta Cloud API.");
    }
  }

  async logout() {
    try {
      if (this.client) {
        await this.client.destroy();
      }
    } catch (_) {}
    this.client = null;
    this.ready = false;
    this.qrCode = null;
    this.phone = null;
    this.isInitializing = false;
    this.chatsCache = [];
    this.messagesCache = {};
    this.lastChatsFetch = 0;

    const sessionPath = path.join(__dirname, "../../whatsapp-session");
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    } catch (_) {}
  }
}

module.exports = new WhatsAppService();
