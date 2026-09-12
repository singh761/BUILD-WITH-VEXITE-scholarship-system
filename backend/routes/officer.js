const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db/db");
const { authRequired, requireRole } = require("../middleware/auth");
const { sendApplicationStatusEmail } = require("../utils/mailer");

const router = express.Router();
router.use(authRequired, requireRole("officer", "admin"));

function recordHistory(applicationId, status, note, actorRole) {
  db.prepare(
    `INSERT INTO status_history (id, application_id, status, note, actor_role) VALUES (?, ?, ?, ?, ?)`
  ).run(uuidv4(), applicationId, status, note || null, actorRole || null);
}

// Automated Escalation Matrix: applications pending review > 7 days get flagged.
function checkEscalations() {
  const stale = db
    .prepare(
      `SELECT a.id, a.scheme, a.institute_name, u.email, u.name as student_name
       FROM applications a JOIN users u ON a.student_id = u.id
       WHERE a.status IN ('submitted','under_review')
       AND julianday('now') - julianday(a.created_at) > 7`
    )
    .all();
  for (const row of stale) {
    db.prepare(`UPDATE applications SET status = 'escalated', updated_at = datetime('now') WHERE id = ?`).run(row.id);
    recordHistory(row.id, "escalated", "Auto-escalated to District Tribal Welfare Officer after 7 business days", "system");
    sendApplicationStatusEmail({
      to: row.email,
      studentName: row.student_name,
      scheme: row.scheme,
      instituteName: row.institute_name,
      status: "escalated",
    });
  }
  return stale.length;
}

// GET /api/officer/applications — full queue with joined student info, grouped by risk score
router.get("/applications", (req, res) => {
  checkEscalations();
  const { status, risk, scheme } = req.query;

  let query = `
    SELECT a.*, u.name as student_name, u.email as student_email, u.tribe, u.district, u.state
    FROM applications a JOIN users u ON a.student_id = u.id
    WHERE 1=1`;
  const params = [];
  if (status) { query += " AND a.status = ?"; params.push(status); }
  if (risk) { query += " AND a.risk_score = ?"; params.push(risk); }
  if (scheme) { query += " AND a.scheme = ?"; params.push(scheme); }
  query += " ORDER BY CASE a.risk_score WHEN 'Red' THEN 0 WHEN 'Yellow' THEN 1 ELSE 2 END, a.created_at ASC";

  const apps = db.prepare(query).all(...params);
  res.json(apps);
});

// Summary counts for dashboard widgets
router.get("/summary", (req, res) => {
  checkEscalations();
  const byStatus = db.prepare("SELECT status, COUNT(*) as count FROM applications GROUP BY status").all();
  const byRisk = db.prepare("SELECT risk_score, COUNT(*) as count FROM applications WHERE risk_score IS NOT NULL GROUP BY risk_score").all();
  const totalDisbursed = db.prepare("SELECT COALESCE(SUM(disbursed_amount),0) as total FROM applications WHERE status = 'disbursed'").get();
  res.json({ byStatus, byRisk, totalDisbursed: totalDisbursed.total });
});

// Approve, reject, or move status manually
router.patch("/applications/:id/status", (req, res) => {
  const { status, note } = req.body;
  const allowed = ["under_review", "institute_verified", "approved", "rejected"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${allowed.join(", ")}` });
  }

  const app = db
    .prepare(
      `SELECT a.*, u.email as student_email, u.name as student_name
       FROM applications a JOIN users u ON a.student_id = u.id WHERE a.id = ?`
    )
    .get(req.params.id);
  if (!app) return res.status(404).json({ error: "Application not found" });

  db.prepare(`UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, app.id);
  recordHistory(app.id, status, note || null, req.user.role);

  sendApplicationStatusEmail({
    to: app.student_email,
    studentName: app.student_name,
    scheme: app.scheme,
    instituteName: app.institute_name,
    status,
    note,
  });

  res.json(db.prepare("SELECT * FROM applications WHERE id = ?").get(app.id));
});

// Simulated PFMS DBT Module: triggers a fund transfer on final approval
router.post("/applications/:id/disburse", (req, res) => {
  const app = db
    .prepare(
      `SELECT a.*, u.email as student_email, u.name as student_name
       FROM applications a JOIN users u ON a.student_id = u.id WHERE a.id = ?`
    )
    .get(req.params.id);
  if (!app) return res.status(404).json({ error: "Application not found" });
  if (app.status !== "approved") {
    return res.status(400).json({ error: "Only approved applications can be disbursed" });
  }

  const amount = app.amount_requested || 0;
  db.prepare(
    `UPDATE applications SET status = 'disbursed', disbursed_amount = ?, disbursed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(amount, app.id);
  recordHistory(app.id, "disbursed", `Simulated PFMS DBT transfer of ₹${amount} initiated`, req.user.role);

  sendApplicationStatusEmail({
    to: app.student_email,
    studentName: app.student_name,
    scheme: app.scheme,
    instituteName: app.institute_name,
    status: "disbursed",
    amount,
  });

  res.json({
    message: "Simulated DBT transfer complete",
    transaction_ref: `PFMS-SIM-${Date.now()}`,
    amount,
    application: db.prepare("SELECT * FROM applications WHERE id = ?").get(app.id),
  });
});

module.exports = router;
