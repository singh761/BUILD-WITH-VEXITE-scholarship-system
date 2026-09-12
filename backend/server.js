require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./routes/auth");
const applicationRoutes = require("./routes/applications");
const officerRoutes = require("./routes/officer");
const grievanceRoutes = require("./routes/grievances");

const app = express();
const PORT = process.env.PORT || 5000;

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok", db: "sqlite", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/officer", officerRoutes);
app.use("/api/grievances", grievanceRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`ST Scholarship API (SQLite) running on http://localhost:${PORT}`);
});
