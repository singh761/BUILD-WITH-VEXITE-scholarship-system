// db.js — SQLite database connection and schema initialization
// Replaces MongoDB in the classic MERN stack with a file-based SQLite database.
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "scholarship.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------- Schema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id     TEXT UNIQUE,
  role          TEXT NOT NULL CHECK (role IN ('student', 'officer', 'admin')),
  phone         TEXT,
  tribe         TEXT,
  district      TEXT,
  state         TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id                  TEXT PRIMARY KEY,
  student_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheme              TEXT NOT NULL CHECK (scheme IN ('Pre-Matric', 'Post-Matric', 'NFST', 'NOS')),
  institute_name      TEXT NOT NULL,
  course              TEXT,
  annual_income       REAL,
  caste_cert_number   TEXT,
  bank_account        TEXT,
  ifsc                TEXT,
  amount_requested    REAL,
  status              TEXT NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('submitted','under_review','institute_verified',
                                          'escalated','approved','rejected','disbursed')),
  ocr_confidence      REAL,
  risk_score          TEXT CHECK (risk_score IN ('Green','Yellow','Red')),
  risk_reasons        TEXT,
  institute_deadline  TEXT,
  disbursed_amount    REAL,
  disbursed_at        TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id              TEXT PRIMARY KEY,
  application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('caste_certificate','income_certificate','marksheet','bank_passbook')),
  file_name       TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  extracted_json  TEXT,
  confidence      REAL,
  anomaly_flags   TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS status_history (
  id              TEXT PRIMARY KEY,
  application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status          TEXT NOT NULL,
  note            TEXT,
  actor_role      TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grievances (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id  TEXT REFERENCES applications(id) ON DELETE SET NULL,
  message         TEXT NOT NULL,
  sentiment       TEXT CHECK (sentiment IN ('Neutral','Negative','Urgent')),
  priority        TEXT CHECK (priority IN ('Normal','High')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at      TEXT DEFAULT (datetime('now'))
);
`);

module.exports = db;
