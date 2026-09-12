// geminiClient.js
// -----------------------------------------------------------------------------
// Thin wrapper around the Google Gemini API (generateContent, REST).
// - Uses global fetch (Node 18+), no extra SDK dependency required.
// - Every call is wrapped so a missing key, network error, or malformed
//   response NEVER crashes a request — callers get `null` back and are
//   expected to fall back to the existing heuristic engine.
// - Model id is configurable via GEMINI_MODEL because Google rotates/retires
//   model names frequently; if you see 404s, check
//   https://ai.google.dev/gemini-api/docs/models and update .env.
// -----------------------------------------------------------------------------

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Calls Gemini with a plain prompt (and optional system instruction).
 * Returns the raw text response, or null on any failure/missing config.
 */
async function callGemini(prompt, { systemInstruction, jsonMode = false, timeoutMs = 8000 } = {}) {
  if (!GEMINI_API_KEY) {
    console.warn("[gemini] GEMINI_API_KEY not set — falling back to heuristic engine");
    return null;
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 512,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[gemini] API error ${res.status}: ${errText.slice(0, 300)}`);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || null;
    return text;
  } catch (err) {
    console.error("[gemini] request failed:", err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Attempts to parse a Gemini JSON response, returns null if it isn't valid JSON. */
function tryParseJSON(text) {
  if (!text) return null;
  try {
    // Strip ```json fences if the model added them despite responseMimeType
    const cleaned = text.replace(/^```json\s*|```\s*$/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

module.exports = { callGemini, tryParseJSON, GEMINI_MODEL, isConfigured: Boolean(GEMINI_API_KEY) };
