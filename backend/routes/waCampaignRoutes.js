const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");
const wa = require("../services/whatsappCloudApi");
const { configureForUser, resetToEnvConfig } = require("../services/waConfigHelper");

router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_campaigns ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { name, description, type, template_id, message_text, media_type, media_url, group_id, scheduled_at } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    let totalContacts = 0;
    if (group_id) {
      const [rows] = await db.promise().query("SELECT COUNT(*) as count FROM wa_group_contacts WHERE group_id = ?", [group_id]);
      totalContacts = rows[0].count;
    }

    const [result] = await db.promise().query(
      `INSERT INTO wa_campaigns (name, description, type, template_id, message_text, media_type, media_url, group_id, status, scheduled_at, total_contacts, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, description || null, type || "text", template_id || null, message_text || null, media_type || null, media_url || null, group_id || null, scheduled_at ? "scheduled" : "draft", scheduled_at || null, totalContacts, req.user?.id || null]
    );
    const [row] = await db.promise().query("SELECT * FROM wa_campaigns WHERE id = ?", [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_campaigns WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Campaign not found" });
    const [messages] = await db.promise().query(
      "SELECT * FROM wa_campaign_messages WHERE campaign_id = ? ORDER BY created_at ASC",
      [req.params.id]
    );
    res.json({ ...rows[0], messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { name, description, type, template_id, message_text, group_id, scheduled_at, status } = req.body;
    await db.promise().query(
      `UPDATE wa_campaigns SET name=?, description=?, type=?, template_id=?, message_text=?, group_id=?, scheduled_at=?, status=? WHERE id=?`,
      [name, description, type, template_id, message_text, group_id, scheduled_at, status, req.params.id]
    );

    if (group_id) {
      const [rows] = await db.promise().query("SELECT COUNT(*) as count FROM wa_group_contacts WHERE group_id = ?", [group_id]);
      await db.promise().query("UPDATE wa_campaigns SET total_contacts = ? WHERE id = ?", [rows[0].count, req.params.id]);
    }

    const [row] = await db.promise().query("SELECT * FROM wa_campaigns WHERE id = ?", [req.params.id]);
    res.json(row[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_campaigns WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/start", auth, async (req, res) => {
  try {
    const [campaigns] = await db.promise().query("SELECT * FROM wa_campaigns WHERE id = ?", [req.params.id]);
    if (!campaigns.length) return res.status(404).json({ error: "Campaign not found" });
    const campaign = campaigns[0];

    const userConfigLoaded = await configureForUser(req.user.id);
    if (!userConfigLoaded && !wa.isConfigured()) {
      return res.status(400).json({ error: "WhatsApp not configured. Please add your API credentials in Settings > WhatsApp Config." });
    }
    if (!userConfigLoaded) resetToEnvConfig();

    let contacts = [];
    if (campaign.group_id) {
      const [rows] = await db.promise().query("SELECT * FROM wa_group_contacts WHERE group_id = ?", [campaign.group_id]);
      contacts = rows;
    }

    if (!contacts.length) return res.status(400).json({ error: "No contacts in selected group" });

    const { addBulkMessages } = require("../services/waQueue");
    const wa = require("../services/whatsappCloudApi");

    let templateName = null;
    let templateComponents = [];
    if (campaign.template_id) {
      const [tmpl] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ?", [campaign.template_id]);
      if (tmpl.length) {
        templateName = tmpl[0].name;
        if (tmpl[0].header_type && tmpl[0].header_value) {
          templateComponents.push({
            type: "header",
            parameters: [{ type: "text", text: tmpl[0].header_value }],
          });
        }
        if (tmpl[0].buttons) {
          const btns = typeof tmpl[0].buttons === "string" ? JSON.parse(tmpl[0].buttons) : tmpl[0].buttons;
          templateComponents.push({
            type: "button",
            sub_type: "quick_reply",
            index: 0,
            parameters: btns.map((b) => ({ type: "payload", payload: b.payload || b.id })),
          });
        }
      }
    }

    const messageList = contacts.map((c) => {
      const phone = c.country_code + c.phone.replace(/^0+/, "");
      return {
        phone,
        contactId: c.id,
        contactName: c.name,
        message: campaign.message_text,
        templateName,
        templateComponents,
      };
    });

    await db.promise().query(
      `INSERT INTO wa_campaign_messages (campaign_id, phone, contact_name, message_text, template_name, template_components, status) VALUES ?`,
      [messageList.map((m) => [campaign.id, m.phone, m.contactName, m.message, m.templateName, m.templateComponents.length ? JSON.stringify(m.templateComponents) : null, "queued"])]
    );

    const [insertedMessages] = await db.promise().query(
      "SELECT id, phone, contact_name, message_text, template_name FROM wa_campaign_messages WHERE campaign_id = ? AND status = 'queued'",
      [campaign.id]
    );

    const queueJobs = insertedMessages.map((m) => ({
      campaignId: campaign.id,
      contactId: m.id,
      phone: m.phone,
      message: m.message_text,
      templateName: m.template_name,
      templateComponents: m.template_components ? (typeof m.template_components === "string" ? JSON.parse(m.template_components) : m.template_components) : [],
    }));

    await addBulkMessages(campaign.id, queueJobs);

    await db.promise().query("UPDATE wa_campaigns SET status = 'running', started_at = NOW() WHERE id = ?", [campaign.id]);
    const [updated] = await db.promise().query("SELECT * FROM wa_campaigns WHERE id = ?", [campaign.id]);

    res.json({ success: true, campaign: updated[0], totalMessages: messageList.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/create-direct", auth, async (req, res) => {
  try {
    const { name, message_text, contacts, delay_seconds = 7 } = req.body;
    if (!name || !message_text) return res.status(400).json({ error: "name and message_text required" });
    if (!contacts || !Array.isArray(contacts) || !contacts.length) {
      return res.status(400).json({ error: "No contacts provided" });
    }

    const [grpRes] = await db.promise().query(
      "INSERT INTO wa_contact_groups (name, description, created_by) VALUES (?,?,?)",
      [name + " (Group)", `Direct campaign group for ${contacts.length} contacts`, req.user?.id || null]
    );
    const groupId = grpRes.insertId;

    const values = contacts.map(c => [
      groupId,
      c.name || null,
      c.phone.replace(/[^0-9]/g, "").slice(-10),
      c.country_code || "91",
      c.source || null
    ]);

    await db.promise().query(
      "INSERT IGNORE INTO wa_group_contacts (group_id, name, phone, country_code, notes) VALUES ?",
      [values]
    );

    const [campRes] = await db.promise().query(
      `INSERT INTO wa_campaigns (name, description, type, message_text, group_id, status, total_contacts, created_by) VALUES (?,?,?,?,?,?,?,?)`,
      [name, `Bulk direct campaign for ${contacts.length} contacts`, "text", message_text, groupId, "running", contacts.length, req.user?.id || null]
    );
    const campaignId = campRes.insertId;

    const { addBulkMessages } = require("../services/waQueue");
    const [groupContacts] = await db.promise().query("SELECT * FROM wa_group_contacts WHERE group_id = ?", [groupId]);

    const messageList = groupContacts.map((c) => ({
      phone: (c.country_code || "91") + c.phone.replace(/^0+/, ""),
      contactId: c.id,
      contactName: c.name,
      message: message_text,
      templateName: null,
      templateComponents: []
    }));

    await db.promise().query(
      `INSERT INTO wa_campaign_messages (campaign_id, phone, contact_name, message_text, status) VALUES ?`,
      [messageList.map((m) => [campaignId, m.phone, m.contactName, m.message, "queued"])]
    );

    const [insertedMessages] = await db.promise().query(
      "SELECT id, phone, contact_name, message_text FROM wa_campaign_messages WHERE campaign_id = ? AND status = 'queued'",
      [campaignId]
    );

    const queueJobs = insertedMessages.map((m) => ({
      campaignId: campaignId,
      contactId: m.id,
      phone: m.phone,
      message: m.message_text,
    }));

    const intervalMs = (Number(delay_seconds) || 7) * 1000;
    await addBulkMessages(campaignId, queueJobs, 0, intervalMs);

    await db.promise().query("UPDATE wa_campaigns SET status = 'running', started_at = NOW() WHERE id = ?", [campaignId]);
    res.status(201).json({ success: true, campaignId, totalContacts: contacts.length, delaySeconds: delay_seconds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/pause", auth, async (req, res) => {
  try {
    await db.promise().query("UPDATE wa_campaigns SET status = 'paused' WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/stop", auth, async (req, res) => {
  try {
    await db.promise().query("UPDATE wa_campaigns SET status = 'completed', completed_at = NOW() WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;