const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

// CREATE - Admin/SubAdmin only (via auth/create-user, this is for legacy direct creation)
router.post("/new", verifyToken, isAdmin, (req, res) => {
  const { first_name, last_name, emp_email, mobile, job_title, emp_role, quotation_count, emp_id, emp_address, mobile_number } = req.body;

  if (!first_name || !last_name || !emp_email || !job_title || !emp_role) {
    return res.status(400).json({ message: "Required fields: first_name, last_name, emp_email, job_title, emp_role" });
  }

  const sql = `
  INSERT INTO teammember
  (first_name, last_name, emp_email, mobile, job_title, emp_role, quotation_count, emp_id, emp_address, mobile_number)
  VALUES (?,?,?,?,?,?,?,?,?,?)
  `;

  db.query(sql, [first_name, last_name || "", emp_email, mobile || null, job_title, emp_role, quotation_count || 0, emp_id || null, emp_address || null, mobile_number || null],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true, id: result.insertId });
    });
});


/* GET ALL - Public (for dropdowns in forms) - No auth required */
router.get("/", (req, res) => {
  db.query("SELECT id, first_name, last_name, emp_email, job_title, emp_role, user_id, emp_id, mobile, mobile_number, emp_address FROM teammember ORDER BY first_name", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

/* GET ALL - Admin/SubAdmin only (full data including user status & work metrics) */
router.get("/admin", verifyToken, isAdmin, (req, res) => {
  const sql = `
    SELECT 
      t.*, 
      u.email, 
      u.role as user_role, 
      u.status as user_status,
      (SELECT COUNT(*) FROM quotations q WHERE q.created_by = t.user_id OR LOWER(q.exec_name) LIKE CONCAT('%', LOWER(t.first_name), '%')) as quotations_count,
      (SELECT COUNT(*) FROM performainvoices pi WHERE pi.created_by = t.user_id OR LOWER(pi.exec_name) LIKE CONCAT('%', LOWER(t.first_name), '%')) as proformas_count,
      (SELECT COUNT(*) FROM services s WHERE s.created_by = t.user_id OR LOWER(s.engineer_name) LIKE CONCAT('%', LOWER(t.first_name), '%')) as services_count,
      (SELECT COUNT(*) FROM clients c WHERE c.created_by = t.user_id OR c.assigned_teammember_id = t.id OR c.assigned_teammember_id = t.user_id OR LOWER(c.name) LIKE CONCAT('%', LOWER(t.first_name), '%') OR LOWER(c.company_name) LIKE CONCAT('%', LOWER(t.first_name), '%')) as clients_count,
      (
        (SELECT COUNT(*) FROM telecalls tc WHERE tc.created_by = t.user_id OR tc.assigned_to = t.user_id OR LOWER(tc.staff_name) LIKE CONCAT('%', LOWER(t.first_name), '%')) +
        (SELECT COUNT(*) FROM walkins w WHERE w.created_by = t.user_id OR w.assigned_to = t.user_id OR LOWER(w.staff_name) LIKE CONCAT('%', LOWER(t.first_name), '%')) +
        (SELECT COUNT(*) FROM fields f WHERE f.created_by = t.user_id OR f.assigned_to = t.user_id OR LOWER(f.staff_name) LIKE CONCAT('%', LOWER(t.first_name), '%'))
      ) as leads_count,
      (SELECT COUNT(*) FROM task_assignments ta WHERE ta.assigned_to_user_id = t.user_id OR ta.assigned_to_user_id = t.id) as tasks_count
    FROM teammember t
    LEFT JOIN users u ON t.user_id = u.id
    ORDER BY t.id DESC
  `;
  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching team admin list:", err);
      // Fallback query if subquery table structure differs
      return db.query(`SELECT t.*, u.email, u.role as user_role, u.status as user_status FROM teammember t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.id DESC`, (err2, res2) => {
        if (err2) return res.status(500).json(err2);
        res.json(res2);
      });
    }
    res.json(result);
  });
});

/* GET by user_id - Get team member linked to a user account */
router.get("/by-user/:userId", verifyToken, (req, res) => {
  db.query(
    "SELECT * FROM teammember WHERE user_id = ?",
    [req.params.userId],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result[0] || null);
    }
  );
});

/* GET single by id with work stats */
router.get("/:id", verifyToken, (req, res) => {
  const sql = `
    SELECT 
      t.*, 
      u.email, 
      u.role as user_role, 
      u.status as user_status,
      (SELECT COUNT(*) FROM quotations q WHERE q.created_by = t.user_id OR LOWER(q.exec_name) LIKE CONCAT('%', LOWER(t.first_name), '%')) as quotations_count,
      (SELECT COUNT(*) FROM performainvoices pi WHERE pi.created_by = t.user_id OR LOWER(pi.exec_name) LIKE CONCAT('%', LOWER(t.first_name), '%')) as proformas_count,
      (SELECT COUNT(*) FROM services s WHERE s.created_by = t.user_id OR LOWER(s.engineer_name) LIKE CONCAT('%', LOWER(t.first_name), '%')) as services_count,
      (SELECT COUNT(*) FROM clients c WHERE c.created_by = t.user_id OR c.assigned_teammember_id = t.id OR c.assigned_teammember_id = t.user_id OR LOWER(c.name) LIKE CONCAT('%', LOWER(t.first_name), '%') OR LOWER(c.company_name) LIKE CONCAT('%', LOWER(t.first_name), '%')) as clients_count,
      (
        (SELECT COUNT(*) FROM telecalls tc WHERE tc.created_by = t.user_id OR tc.assigned_to = t.user_id OR LOWER(tc.staff_name) LIKE CONCAT('%', LOWER(t.first_name), '%')) +
        (SELECT COUNT(*) FROM walkins w WHERE w.created_by = t.user_id OR w.assigned_to = t.user_id OR LOWER(w.staff_name) LIKE CONCAT('%', LOWER(t.first_name), '%')) +
        (SELECT COUNT(*) FROM fields f WHERE f.created_by = t.user_id OR f.assigned_to = t.user_id OR LOWER(f.staff_name) LIKE CONCAT('%', LOWER(t.first_name), '%'))
      ) as leads_count,
      (SELECT COUNT(*) FROM task_assignments ta WHERE ta.assigned_to_user_id = t.user_id OR ta.assigned_to_user_id = t.id) as tasks_count
    FROM teammember t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.id = ?
  `;
  db.query(sql, [req.params.id], (err, result) => {
    if (err || !result || result.length === 0) {
      return db.query(`SELECT t.*, u.email, u.role as user_role, u.status as user_status FROM teammember t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = ?`, [req.params.id], (err2, result2) => {
        if (err2 || !result2 || result2.length === 0) return res.status(404).json({ message: "Not found" });
        res.json(result2[0]);
      });
    }
    res.json(result[0]);
  });
});


// Edit - Admin/SubAdmin only
router.put("/:id", verifyToken, isAdmin, (req, res) => {
  const { first_name, last_name, emp_email, mobile, job_title, emp_role, quotation_count, emp_id, emp_address, mobile_number } = req.body;

  const sql = `
   UPDATE teammember
   SET first_name=?, last_name=?, emp_email=?, mobile=?, job_title=?, emp_role=?, quotation_count=?, emp_id=?, emp_address=?, mobile_number=?
   WHERE id=?
  `;

  db.query(sql,
    [first_name, last_name || "", emp_email, mobile || null, job_title, emp_role, quotation_count || 0, emp_id || null, emp_address || null, mobile_number || null, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);

      // If the teammember has a linked user, also update the users table first_name
      if (first_name) {
        db.query("UPDATE users SET first_name=? WHERE id=(SELECT user_id FROM teammember WHERE id=?)", [first_name, req.params.id], () => {});
      }

      res.json({ success: true });
    }
  );
});


/* DELETE - Admin only */
router.delete("/:id", verifyToken, isAdmin, (req, res) => {
  db.query("SELECT user_id, emp_email FROM teammember WHERE id=?", [req.params.id], (err, rows) => {
    if (err) return res.status(500).json(err);
    const userId = rows?.[0]?.user_id;
    const empEmail = rows?.[0]?.emp_email;

    if (empEmail && empEmail.toLowerCase() === "kk@achmecommunication.com") {
      return res.status(403).json({ message: "Cannot delete the primary admin account" });
    }

    db.query("DELETE FROM teammember WHERE id=?", [req.params.id], (err2) => {
      if (err2) return res.status(500).json(err2);
      if (userId) {
        db.query("DELETE FROM users WHERE id=?", [userId], () => {});
      }
      res.json({ success: true, message: "Team member deleted successfully" });
    });
  });
});

module.exports = router;
