// aiEngine.js
// -----------------------------------------------------------------------------
// Deterministic, explainable STAND-INS for the AI/ML modules described in the
// spec (LayoutLM/Tesseract OCR, stamp/signature CV, fraud anomaly engine,
// sentiment analysis). Each function is written so a real model call can be
// swapped in later without changing the calling code.
// -----------------------------------------------------------------------------

const path = require("path");
const { callGemini, tryParseJSON } = require("./geminiClient");

/**
 * Simulates OCR field extraction from an uploaded document.
 * A real system would call LayoutLM/Tesseract here on the file bytes.
 */
function simulateOCR(docType, fileName) {
  // Confidence is derived from filename heuristics for demo-repeatability,
  // then jittered slightly so the sandbox feels alive.
  let base = 0.9;
  const lower = fileName.toLowerCase();
  if (lower.includes("blur") || lower.includes("scan") || lower.includes("low")) base = 0.62;
  if (lower.includes("fake") || lower.includes("test")) base = 0.4;

  const jitter = (Math.random() - 0.5) * 0.08;
  const confidence = Math.max(0.3, Math.min(0.99, base + jitter));

  const fieldsByType = {
    caste_certificate: {
      certificate_number: `ST/${Math.floor(100000 + Math.random() * 899999)}`,
      tribe_name: "Extracted-Tribe-Name",
      issuing_authority: "Sub-Divisional Magistrate",
      issue_date: "2023-06-14",
    },
    income_certificate: {
      annual_income: Math.floor(30000 + Math.random() * 200000),
      issuing_authority: "Tehsildar Office",
      issue_date: "2024-01-20",
    },
    marksheet: {
      student_name: "Extracted-Student-Name",
      semester: "Semester 4",
      percentage: Math.floor(45 + Math.random() * 50),
    },
    bank_passbook: {
      account_number: `XXXXXXXX${Math.floor(1000 + Math.random() * 8999)}`,
      ifsc: "SBIN0001234",
    },
  };

  return {
    confidence: Number(confidence.toFixed(2)),
    extracted: fieldsByType[docType] || {},
  };
}

/**
 * Simulates the Certificate Anomaly Engine: flags unnatural values,
 * mismatched serials, or implausible income declarations.
 */
function detectAnomalies({ docType, extracted, declaredIncome }) {
  const flags = [];

  if (docType === "income_certificate" && declaredIncome != null && extracted.annual_income != null) {
    const diff = Math.abs(declaredIncome - extracted.annual_income) / Math.max(declaredIncome, 1);
    if (diff > 0.25) {
      flags.push(
        `Declared income (₹${declaredIncome}) differs from certificate OCR value (₹${extracted.annual_income}) by ${(diff * 100).toFixed(0)}%`
      );
    }
  }

  if (docType === "caste_certificate" && extracted.certificate_number && !/^ST\/\d{6}$/.test(extracted.certificate_number)) {
    flags.push("Certificate serial number format looks non-standard");
  }

  if (docType === "marksheet" && extracted.percentage != null && extracted.percentage < 33) {
    flags.push("Marksheet percentage below minimum eligibility threshold");
  }

  return flags;
}

/**
 * Smart Institute Verification / AI Confidence Scoring →
 * combines OCR confidence + anomaly count into a traffic-light Risk Score.
 */
function computeRiskScore({ ocrConfidences, anomalyCount }) {
  const avgConfidence =
    ocrConfidences.length > 0 ? ocrConfidences.reduce((a, b) => a + b, 0) / ocrConfidences.length : 0;

  const reasons = [];
  let score;

  if (avgConfidence >= 0.9 && anomalyCount === 0) {
    score = "Green";
    reasons.push("High OCR confidence across all documents, no anomalies detected");
  } else if (avgConfidence >= 0.7 && anomalyCount <= 1) {
    score = "Yellow";
    reasons.push("Moderate OCR confidence or a single flagged anomaly — manual review recommended");
  } else {
    score = "Red";
    reasons.push("Low OCR confidence or multiple anomalies — manual verification required");
  }

  return {
    score,
    avgConfidence: Number(avgConfidence.toFixed(2)),
    reasons,
  };
}

/**
 * Simulates NLP sentiment analysis on grievance text to prioritize urgent
 * cases (e.g. non-disbursement before an exam fee deadline).
 */
function analyzeSentiment(message) {
  const urgentWords = ["urgent", "exam", "deadline", "emergency", "immediately", "fee due", "last date"];
  const negativeWords = ["not received", "delay", "pending", "no response", "problem", "issue", "denied"];

  const lower = message.toLowerCase();
  const isUrgent = urgentWords.some((w) => lower.includes(w));
  const isNegative = negativeWords.some((w) => lower.includes(w));

  if (isUrgent) return { sentiment: "Urgent", priority: "High" };
  if (isNegative) return { sentiment: "Negative", priority: "Normal" };
  return { sentiment: "Neutral", priority: "Normal" };
}

/** Basic filename → doc type sanity check, used before OCR simulation. */
function inferExtension(fileName) {
  return path.extname(fileName).toLowerCase();
}

// -----------------------------------------------------------------------------
// Gemini-backed upgrades. Each one tries the real model first and silently
// falls back to the deterministic heuristic above if GEMINI_API_KEY is unset,
// the request fails, or the response can't be parsed — so the app always
// keeps working, with or without a key.
// -----------------------------------------------------------------------------

/**
 * Grievance triage using Gemini: classifies sentiment/urgency and gives a
 * short reason, instead of the keyword-matching heuristic.
 */
async function analyzeSentimentWithGemini(message) {
  const prompt = `You are triaging a student grievance for a Scheduled Tribe (ST) scholarship helpdesk in India.
Classify the message below and respond with ONLY minified JSON, no prose, in this exact shape:
{"sentiment":"Urgent"|"Negative"|"Neutral"|"Positive","priority":"High"|"Normal","reason":"<one short sentence>"}

Message: """${message}"""`;

  const raw = await callGemini(prompt, {
    systemInstruction: "You are a precise classifier. Always return valid minified JSON and nothing else.",
    jsonMode: true,
  });
  const parsed = tryParseJSON(raw);

  if (parsed && parsed.sentiment && parsed.priority) {
    return {
      sentiment: parsed.sentiment,
      priority: parsed.priority,
      reason: parsed.reason || null,
      source: "gemini",
    };
  }

  // Fallback to the deterministic heuristic
  return { ...analyzeSentiment(message), reason: null, source: "heuristic" };
}

/**
 * Turns a risk score + reason codes into a friendly, plain-language
 * explanation for the student viewing their own application.
 */
async function explainRiskWithGemini({ scheme, riskScore, reasons, ocrConfidence }) {
  const prompt = `A student applied for the "${scheme}" ST scholarship. Their application's automated
verification risk score is "${riskScore}" (Green = clear, Yellow = needs review, Red = needs manual
verification), average document OCR confidence ${ocrConfidence ?? "unknown"}, with these system notes:
${(reasons || []).map((r) => `- ${r}`).join("\n") || "- none"}

Write a short (2-3 sentence), warm, non-alarming explanation for the student of what this status means
and what happens next. Do not invent facts beyond what's given. Plain text only, no markdown.`;

  const raw = await callGemini(prompt, {
    systemInstruction: "You explain scholarship application statuses clearly and reassuringly to students.",
  });

  if (raw && raw.trim()) return { explanation: raw.trim(), source: "gemini" };

  const fallback =
    (reasons && reasons.length ? reasons.join(" ") : "Your application is being processed.") +
    " You'll be notified as soon as an officer reviews it.";
  return { explanation: fallback, source: "heuristic" };
}

/**
 * Drafts a suggested officer reply to a grievance, for the officer to review
 * and edit before sending — not auto-sent.
 */
async function draftGrievanceReplyWithGemini({ message, sentiment, priority }) {
  const prompt = `A student filed this grievance with an ST scholarship office (priority: ${priority}, sentiment: ${sentiment}):
"""${message}"""

Draft a short, polite, professional reply (3-5 sentences) from the scholarship office. Acknowledge the
issue, avoid promising specific dates unless the student gave one, and invite them to share any
documents needed. Plain text only, no markdown, no placeholders like [Name].`;

  const raw = await callGemini(prompt, {
    systemInstruction: "You draft empathetic, professional grievance-redressal replies for a government scholarship office.",
  });

  if (raw && raw.trim()) return { draft: raw.trim(), source: "gemini" };
  return {
    draft:
      "Thank you for reaching out. We've received your grievance and it is being reviewed by our team. We'll follow up with an update shortly — please let us know if you have any documents to add in the meantime.",
    source: "heuristic",
  };
}

module.exports = {
  simulateOCR,
  detectAnomalies,
  computeRiskScore,
  analyzeSentiment,
  inferExtension,
  analyzeSentimentWithGemini,
  explainRiskWithGemini,
  draftGrievanceReplyWithGemini,
};
