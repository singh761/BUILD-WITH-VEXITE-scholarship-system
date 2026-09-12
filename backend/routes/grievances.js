const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db/db");
const { authRequired, requireRole } = require("../middleware/auth");
const { analyzeSentimentWithGemini, draftGrievanceReplyWithGemini } = require("../utils/aiEngine");
const { sendGrievanceAckEmail, sendGrievanceResolvedEmail } = require("../utils/mailer");

const router = express.Router();

// Student files a grievance — triaged by Gemini (falls back to a heuristic
// classifier automatically if GEMINI_API_KEY isn't set or the call fails)
router.post("/", authRequired, requireRole("student"), async (req, res) => {
  const { message, application_id } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  const { sentiment, priority } = await analyzeSentimentWithGemini(message);
  const id = uuidv4();
  db.prepare(
    `INSERT INTO grievances (id, student_id, application_id, message, sentiment, priority)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, application_id || null, message, sentiment, priority);

  res.status(201).json(db.prepare("SELECT * FROM grievances WHERE id = ?").get(id));

  sendGrievanceAckEmail({ to: req.user.email, studentName: req.user.name, priority });
});

// Student views own grievances
router.get("/mine", authRequired, requireRole("student"), (req, res) => {
  res.json(db.prepare("SELECT * FROM grievances WHERE student_id = ? ORDER BY created_at DESC").all(req.user.id));
});

// Officer views all grievances, High priority first
router.get("/", authRequired, requireRole("officer", "admin"), (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT g.*, u.name as student_name FROM grievances g JOIN users u ON g.student_id = u.id
         ORDER BY CASE g.priority WHEN 'High' THEN 0 ELSE 1 END, g.created_at DESC`
      )
      .all()
  );
});

// Officer requests a Gemini-drafted reply for a grievance (review & edit before sending)
router.get("/:id/ai-draft-reply", authRequired, requireRole("officer", "admin"), async (req, res) => {
  const grievance = db.prepare("SELECT * FROM grievances WHERE id = ?").get(req.params.id);
  if (!grievance) return res.status(404).json({ error: "Grievance not found" });

  const { draft, source } = await draftGrievanceReplyWithGemini({
    message: grievance.message,
    sentiment: grievance.sentiment,
    priority: grievance.priority,
  });

  res.json({ draft, source });
});

// Officer resolves a grievance
router.patch("/:id/resolve", authRequired, requireRole("officer", "admin"), (req, res) => {
  const grievance = db
    .prepare(
      `SELECT g.*, u.email as student_email, u.name as student_name
       FROM grievances g JOIN users u ON g.student_id = u.id WHERE g.id = ?`
    )
    .get(req.params.id);
  if (!grievance) return res.status(404).json({ error: "Grievance not found" });
  db.prepare("UPDATE grievances SET status = 'resolved' WHERE id = ?").run(grievance.id);

  sendGrievanceResolvedEmail({ to: grievance.student_email, studentName: grievance.student_name });

  res.json(db.prepare("SELECT * FROM grievances WHERE id = ?").get(grievance.id));
});

module.exports = router;
