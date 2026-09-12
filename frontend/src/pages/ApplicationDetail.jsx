import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import { RiskPill, StatusPill } from "../components/Pills";
import { useAuth } from "../context/AuthContext";

const DOC_TYPES = [
  { value: "caste_certificate", label: "Caste certificate" },
  { value: "income_certificate", label: "Income certificate" },
  { value: "marksheet", label: "Latest marksheet" },
  { value: "bank_passbook", label: "Bank passbook" },
];

export default function ApplicationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [app, setApp] = useState(null);
  const [error, setError] = useState("");
  const [docType, setDocType] = useState(DOC_TYPES[0].value);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  function load() {
    api.get(`/applications/${id}`)
      .then((res) => setApp(res.data))
      .catch(() => setError("Could not load this application."));
  }

  useEffect(load, [id]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("doc_type", docType);
    fd.append("file", file);
    try {
      await api.post(`/applications/${id}/documents`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFile(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed. Please try a different file.");
    } finally {
      setUploading(false);
    }
  }

  async function explainWithAI() {
    setAiLoading(true);
    try {
      const res = await api.get(`/applications/${id}/ai-explain`);
      setAiExplanation(res.data.explanation);
    } catch {
      setAiExplanation("Could not generate an AI explanation right now — please try again shortly.");
    } finally {
      setAiLoading(false);
    }
  }

  async function updateStatus(status) {
    setActionLoading(true);
    try {
      await api.patch(`/officer/applications/${id}/status`, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not update status.");
    } finally {
      setActionLoading(false);
    }
  }

  async function disburse() {
    setActionLoading(true);
    try {
      await api.post(`/officer/applications/${id}/disburse`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Disbursement failed.");
    } finally {
      setActionLoading(false);
    }
  }

  if (error && !app) return <div style={{ maxWidth: 800, margin: "3rem auto" }}><div className="error-banner">{error}</div></div>;
  if (!app) return <p style={{ textAlign: "center", marginTop: "3rem", color: "var(--ink-soft)" }}>Loading…</p>;

  const isOfficer = user.role === "officer" || user.role === "admin";

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h2>{app.scheme} — {app.institute_name}</h2>
          {isOfficer && <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>{app.student_name} · {app.tribe} · {app.district}, {app.state}</p>}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <RiskPill score={app.risk_score} />
          <StatusPill status={app.status} />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h4 style={{ marginBottom: "1rem" }}>Case summary</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", fontSize: "0.9rem" }}>
          <SummaryItem label="Course" value={app.course || "—"} />
          <SummaryItem label="Annual income" value={app.annual_income ? `₹${app.annual_income.toLocaleString("en-IN")}` : "—"} />
          <SummaryItem label="Amount requested" value={app.amount_requested ? `₹${app.amount_requested.toLocaleString("en-IN")}` : "—"} />
          <SummaryItem label="AI OCR confidence" value={app.ocr_confidence ? `${Math.round(app.ocr_confidence * 100)}%` : "Awaiting documents"} />
          <SummaryItem label="Disbursed amount" value={app.disbursed_amount ? `₹${app.disbursed_amount.toLocaleString("en-IN")}` : "—"} />
          <SummaryItem label="Submitted" value={new Date(app.created_at).toLocaleDateString("en-IN")} />
        </div>
        {app.risk_reasons && (
          <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--ink-soft)", borderTop: "1px solid var(--sandstone-deep)", paddingTop: "0.9rem" }}>
            <strong>AI note:</strong> {JSON.parse(app.risk_reasons).join(" ")}
          </p>
        )}
        <div style={{ marginTop: "1rem", borderTop: app.risk_reasons ? undefined : "1px solid var(--sandstone-deep)", paddingTop: "0.9rem" }}>
          <button className="btn btn-outline" onClick={explainWithAI} disabled={aiLoading} style={{ fontSize: "0.82rem" }}>
            {aiLoading ? "Asking Gemini…" : "✨ Explain this status with AI"}
          </button>
          {aiExplanation && (
            <p style={{ marginTop: "0.7rem", fontSize: "0.88rem", background: "var(--sandstone)", padding: "0.7rem 0.9rem", borderRadius: 8 }}>
              {aiExplanation}
            </p>
          )}
        </div>
      </div>

      {!isOfficer && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ marginBottom: "1rem" }}>Upload a document</h4>
          <form onSubmit={handleUpload} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
              <label>Document type</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
              <label>File</label>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} />
            </div>
            <button className="btn btn-accent" disabled={!file || uploading}>
              {uploading ? "Analyzing…" : "Upload & verify"}
            </button>
          </form>
        </div>
      )}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h4 style={{ marginBottom: "1rem" }}>Documents ({app.documents.length})</h4>
        {app.documents.length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>No documents uploaded yet.</p>}
        {app.documents.map((d) => (
          <div key={d.id} style={{ padding: "0.8rem 0", borderBottom: "1px solid var(--sandstone-deep)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong style={{ fontSize: "0.9rem" }}>{DOC_TYPES.find((t) => t.value === d.doc_type)?.label || d.doc_type}</strong>
              <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>OCR confidence: {Math.round(d.confidence * 100)}%</span>
            </div>
            {d.anomaly_flags?.length > 0 && (
              <p style={{ fontSize: "0.82rem", color: "var(--red-signal)", marginTop: "0.3rem" }}>⚠ {d.anomaly_flags.join("; ")}</p>
            )}
          </div>
        ))}
      </div>

      {isOfficer && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ marginBottom: "1rem" }}>Officer actions</h4>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button className="btn btn-outline" disabled={actionLoading} onClick={() => updateStatus("institute_verified")}>Mark institute-verified</button>
            <button className="btn btn-primary" disabled={actionLoading} onClick={() => updateStatus("approved")}>Approve</button>
            <button className="btn btn-danger" disabled={actionLoading} onClick={() => updateStatus("rejected")}>Reject</button>
            {app.status === "approved" && (
              <button className="btn btn-accent" disabled={actionLoading} onClick={disburse}>Trigger DBT transfer</button>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h4 style={{ marginBottom: "1rem" }}>Timeline</h4>
        {app.history.map((h) => (
          <div key={h.id} style={{ display: "flex", gap: "0.9rem", padding: "0.5rem 0" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)", width: 110, flexShrink: 0 }}>
              {new Date(h.created_at).toLocaleDateString("en-IN")}
            </span>
            <div>
              <StatusPill status={h.status} />
              {h.note && <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: "0.25rem 0 0" }}>{h.note}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div>
      <div style={{ color: "var(--ink-soft)", fontSize: "0.78rem", marginBottom: "0.2rem" }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}
