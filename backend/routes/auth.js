const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { OAuth2Client } = require("google-auth-library");
const db = require("../db/db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

router.post("/register", (req, res) => {
  const { name, email, password, role, phone, tribe, district, state } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "name, email, password and role are required" });
  }
  if (!["student", "officer"].includes(role)) {
    return res.status(400).json({ error: "role must be 'student' or 'officer'" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const id = uuidv4();
  const password_hash = bcrypt.hashSync(password, 10);

  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, phone, tribe, district, state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, email, password_hash, role, phone || null, tribe || null, district || null, state || null);

  const token = jwt.sign({ id, name, role, email }, JWT_SECRET, { expiresIn: "7d" });
  res.status(201).json({ token, user: { id, name, role, email } });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
});

// Google Sign-In: verifies the ID token from Google Identity Services on the
// frontend, then finds the matching user or creates one on first sign-in.
// `role` is only used the first time an account is created via Google.
router.post("/google", async (req, res) => {
  const { credential, role } = req.body;
  if (!credential) return res.status(400).json({ error: "Missing Google credential" });
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "Google sign-in is not configured on this server (missing GOOGLE_CLIENT_ID)" });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: "Could not verify Google credential" });
  }

  const { sub: googleId, email, name, email_verified } = payload;
  if (!email_verified) return res.status(401).json({ error: "Google account email is not verified" });

  let user = db.prepare("SELECT * FROM users WHERE google_id = ? OR email = ?").get(googleId, email);

  if (!user) {
    const chosenRole = ["student", "officer"].includes(role) ? role : "student";
    const id = uuidv4();
    db.prepare(
      `INSERT INTO users (id, name, email, google_id, role) VALUES (?, ?, ?, ?, ?)`
    ).run(id, name || email, email, googleId, chosenRole);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  } else if (!user.google_id) {
    // An account with this email already exists via password signup — link it.
    db.prepare("UPDATE users SET google_id = ? WHERE id = ?").run(googleId, user.id);
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
});

module.exports = router;
