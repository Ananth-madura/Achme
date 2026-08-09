const express = require("express");
const router = express.Router();
const wa = require("../services/whatsappService");

router.get("/status", (req, res) => {
  res.json(wa.getStatus());
});

router.get("/unified-status", (req, res) => {
  res.json(wa.getUnifiedStatus());
});

router.post("/test-send", async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) return res.status(400).json({ error: "phone is required" });
    const result = await wa.sendTestMessage(phone, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/qr", async (req, res) => {
  try {
    if (req.query.force === "true" || req.query.refresh === "true") {
      await wa.logout().catch(() => {});
    }
    const qr = await wa.getQr();
    res.json({ qr });
  } catch (err) {
    res.status(408).json({ error: err.message || "QR timeout" });
  }
});

router.get("/pairing-code", async (req, res) => {
  try {
    const phone = req.query.phone;
    if (!phone) return res.status(400).json({ error: "phone query parameter is required (e.g. ?phone=919876543210)" });
    const code = await wa.getPairingCode(phone);
    res.json({ code });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to generate pairing code" });
  }
});

router.get("/chats", async (req, res) => {
  try {
    const chats = await wa.getChats(req.query.refresh === "true");
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/chat/:chatId/messages", async (req, res) => {
  try {
    const messages = await wa.getMessages(req.params.chatId);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/send", async (req, res) => {
  try {
    const { chatId, message } = req.body;
    if (!chatId || !message) {
      return res.status(400).json({ error: "chatId and message required" });
    }
    const result = await wa.sendMessage(chatId, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/logout", async (req, res) => {
  try {
    await wa.logout();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
