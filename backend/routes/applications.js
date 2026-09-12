const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const db = require("../db/db");
const { authRequired, requireRole } = require("../middleware/auth");
const { simulateOCR, detectAnomalies, computeRiskScore, explainRiskWithGemini } = require("../utils/aiEngine");
const { sendApplicationStatusEmail } = require("../utils/mailer");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

function recordHistory(applicationId, status, note, actorRole) {
  db.prepare(
    `INSERT INTO status_history (id, application_id, status, note, actor_role) VALUES (?, ?, ?, ?, ?)`
  ).run(uuidv4(), applicationId, status, note || null, actorRole || null);
}

// Create a new application (student only)
router.post("/", authRequired, requireRole("student"), (req, res) => {
  const { scheme, institute_name, course, annual_income, caste_cert_number, bank_account, ifsc, amount_requested } =
    req.body;

  if (!scheme || !institute_name) {
    return res.status(400).json({ error: "scheme and institute_name are required" });
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO applications
      (id, student_id, scheme, institute_name, course, annual_income, caste_cert_number, bank_account, ifsc, amount_requested, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`
  ).run(
    id,
    req.user.id,
    scheme,
    institute_name,
    course || null,
    annual_income || null,
    caste_cert_number || null,
    bank_account || null,
    ifsc || null,
    amount_requested || null
  );

  recordHistory(id, "submitted", "Application submitted by student", "student");
  const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(id);

  sendApplicationStatusEmail({
    to: req.user.email,
    studentName: req.user.name,
    scheme: app.scheme,
    instituteName: app.institute_name,
    status: "submitted",
  });

  res.status(201).json(app);
});

// Upload a document to an application — runs the simulated OCR + anomaly engine
router.post("/:id/documents", authRequired, requireRole("student"), upload.single("file"), (req, res) => {
  const application = db.prepare("SELECT * FROM applications WHERE id = ? AND student_id = ?").get(
    req.params.id,
    req.user.id
  );
  if (!application) return res.status(404).json({ error: "Application not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { doc_type } = req.body;
  const validTypes = ["caste_certificate", "income_certificate", "marksheet", "bank_passbook"];
  if (!validTypes.includes(doc_type)) {
    return res.status(400).json({ error: `doc_type must be one of ${validTypes.join(", ")}` });
  }

  const { confidence, extracted } = simulateOCR(doc_type, req.file.originalname);
  const anomalies = detectAnomalies({
    docType: doc_type,
    extracted,
    declaredIncome: application.annual_income,
  });

  const docId = uuidv4();
  db.prepare(
    `INSERT INTO documents (id, application_id, doc_type, file_name, file_path, extracted_json, confidence, anomaly_flags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    docId,
    application.id,
    doc_type,
    req.file.originalname,
    req.file.path,
    JSON.stringify(extracted),
    confidence,
    JSON.stringify(anomalies)
  );

  // Recompute the whole application's risk score from all documents on file
  const docs = db.prepare("SELECT confidence, anomaly_flags FROM documents WHERE application_id = ?").all(application.id);
  const ocrConfidences = docs.map((d) => d.confidence);
  const anomalyCount = docs.reduce((sum, d) => sum + (JSON.parse(d.anomaly_flags || "[]").length), 0);
  const { score, avgConfidence, reasons } = computeRiskScore({ ocrConfidences, anomalyCount });

  db.prepare(
    `UPDATE applications SET ocr_confidence = ?, risk_score = ?, risk_reasons = ?, status = CASE WHEN status = 'submitted' THEN 'under_review' ELSE status END, updated_at = datetime('now') WHERE id = ?`
  ).run(avgConfidence, score, JSON.stringify(reasons), application.id);

  if (application.status === "submitted") {
    recordHistory(application.id, "under_review", "AI OCR verification started", "system");
    sendApplicationStatusEmail({
      to: req.user.email,
      studentName: req.user.name,
      scheme: application.scheme,
      instituteName: application.institute_name,
      status: "under_review",
    });
  }

  res.status(201).json({
    document: { id: docId, doc_type, confidence, extracted, anomalies },
    application_risk: { score, avgConfidence, reasons },
  });
});

// List the current student's applications
router.get("/mine", authRequired, requireRole("student"), (req, res) => {
  const apps = db
    .prepare("SELECT * FROM applications WHERE student_id = ? ORDER BY created_at DESC")
    .all(req.user.id);
  res.json(apps);
});

// View a single application with its documents and history (owner or officer)
router.get("/:id", authRequired, (req, res) => {
  const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
  if (!app) return res.status(404).json({ error: "Application not found" });
  if (req.user.role === "student" && app.student_id !== req.user.id) {
    return res.status(403).json({ error: "You may only view your own applications" });
  }

  const documents = db.prepare("SELECT * FROM documents WHERE application_id = ?").all(app.id);
  const history = db
    .prepare("SELECT * FROM status_history WHERE application_id = ? ORDER BY created_at ASC")
    .all(app.id);

  res.json({
    ...app,
    documents: documents.map((d) => ({ ...d, extracted_json: JSON.parse(d.extracted_json || "{}"), anomaly_flags: JSON.parse(d.anomaly_flags || "[]") })),
    history,
  });
});

// Gemini-generated plain-language explanation of the application's AI risk score
// (owner student or an officer/admin can request this)
router.get("/:id/ai-explain", authRequired, async (req, res) => {
  const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
  if (!app) return res.status(404).json({ error: "Application not found" });
  if (req.user.role === "student" && app.student_id !== req.user.id) {
    return res.status(403).json({ error: "You may only view your own applications" });
  }

  const reasons = app.risk_reasons ? JSON.parse(app.risk_reasons) : [];
  const { explanation, source } = await explainRiskWithGemini({
    scheme: app.scheme,
    riskScore: app.risk_score || "Pending",
    reasons,
    ocrConfidence: app.ocr_confidence,
  });

  res.json({ explanation, source });
});

module.exports = router;
