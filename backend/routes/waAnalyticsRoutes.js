const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");

router.get("/summary", auth, async (req, res) => {
  try {
    const [[{ totalCampaigns }]] = await db.promise().query("SELECT COUNT(*) as totalCampaigns FROM wa_campaigns");
    const [[{ totalSent }]] = await db.promise().query("SELECT COUNT(*) as totalSent FROM wa_message_logs WHERE status IN ('sent','delivered','read')");
    const [[{ totalDelivered }]] = await db.promise().query("SELECT COUNT(*) as totalDelivered FROM wa_message_logs WHERE status = 'delivered'");
    const [[{ totalRead }]] = await db.promise().query("SELECT COUNT(*) as totalRead FROM wa_message_logs WHERE status = 'read'");
    const [[{ totalFailed }]] = await db.promise().query("SELECT COUNT(*) as totalFailed FROM wa_message_logs WHERE status = 'failed'");
    const [[{ totalGroups }]] = await db.promise().query("SELECT COUNT(*) as totalGroups FROM wa_contact_groups");
    const [[{ totalTemplates }]] = await db.promise().query("SELECT COUNT(*) as totalTemplates FROM wa_templates");
    const [[{ totalContacts }]] = await db.promise().query("SELECT SUM(total_contacts) as totalContacts FROM wa_contact_groups");

    res.json({
      totalCampaigns,
      totalSent,
      totalDelivered,
      totalRead,
      totalFailed,
      totalGroups,
      totalTemplates,
      totalContacts: totalContacts || 0,
      deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
      readRate: totalSent > 0 ? Math.round((totalRead / totalSent) * 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/campaigns", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT id, name, type, status, total_contacts, sent_count, delivered_count, read_count, failed_count, scheduled_at, started_at, completed_at, created_at
      FROM wa_campaigns
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/logs", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const status = req.query.status || null;

    let query = "SELECT * FROM wa_message_logs";
    let countQuery = "SELECT COUNT(*) as total FROM wa_message_logs";
    const params = [];
    const countParams = [];

    if (status) {
      query += " WHERE status = ?";
      countQuery += " WHERE status = ?";
      params.push(status);
      countParams.push(status);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(String(limit), String(offset));

    const [rows] = await db.promise().query(query, params);
    const [[{ total }]] = await db.promise().query(countQuery, countParams);

    res.json({ logs: rows, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/daily", auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const [rows] = await db.promise().query(`
      SELECT DATE(created_at) as date,
        SUM(CASE WHEN status IN ('sent','delivered','read') THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM wa_message_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [String(days)]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/status-distribution", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT status, COUNT(*) as count
      FROM wa_message_logs
      GROUP BY status
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;