const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");

router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM wa_templates ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { name, category, language, header_type, header_value, body, footer, button_type, buttons } = req.body;
    if (!name || !body) return res.status(400).json({ error: "name and body required" });
    const [result] = await db.promise().query(
      `INSERT INTO wa_templates (name, category, language, header_type, header_value, body, footer, button_type, buttons, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [name, category || "MARKETING", language || "en", header_type || null, header_value || null, body, footer || null, button_type || null, buttons ? JSON.stringify(buttons) : null, req.user?.id || null]
    );
    const [row] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ?", [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Template not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { name, category, language, header_type, header_value, body, footer, button_type, buttons } = req.body;
    await db.promise().query(
      `UPDATE wa_templates SET name=?, category=?, language=?, header_type=?, header_value=?, body=?, footer=?, button_type=?, buttons=? WHERE id=?`,
      [name, category, language, header_type, header_value, body, footer, button_type, buttons ? JSON.stringify(buttons) : null, req.params.id]
    );
    const [rows] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_templates WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/sync", auth, async (req, res) => {
  try {
    const wa = require("../services/whatsappCloudApi");
    const templates = await wa.getTemplates();
    res.json({ success: true, metaTemplates: templates.data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;