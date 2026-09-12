import { useEffect, useState } from "react";
import api from "../api";

export default function OfficerGrievances() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [draftLoading, setDraftLoading] = useState(null);

  function load() {
    api.get("/grievances").then((res) => setItems(res.data)).catch(() => setError("Could not load grievances."));
  }
  useEffect(load, []);

  async function draftReply(id) {
    setDraftLoading(id);
    try {
      const res = await api.get(`/grievances/${id}/ai-draft-reply`);
      setDrafts((prev) => ({ ...prev, [id]: res.data.draft }));
    } catch {
      setDrafts((prev) => ({ ...prev, [id]: "Could not generate a draft right now — please try again." }));
    } finally {
      setDraftLoading(null);
    }
  }

  async function resolve(id) {
    try {
      await api.patch(`/grievances/${id}/resolve`);
      load();
    } catch {
      setError("Could not resolve this grievance.");
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <h2 style={{ marginBottom: "0.3rem" }}>Grievances</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: "1.8rem", fontSize: "0.92rem" }}>
        Sentiment analysis flags urgent cases — like unpaid exam fees — for same-day attention.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {items?.map((g) => (
        <div key={g.id} className="card" style={{ marginBottom: "0.9rem", borderLeft: g.priority === "High" ? "4px solid var(--red-signal)" : undefined }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <strong style={{ fontSize: "0.9rem" }}>{g.student_name}</strong>
            <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{new Date(g.created_at).toLocaleDateString("en-IN")}</span>
          </div>
          <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>{g.message}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <span className={`status-pill ${g.priority === "High" ? "status-escalated" : ""}`}>{g.sentiment} · {g.priority} priority</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {g.status === "open" && (
                <button className="btn btn-outline" disabled={draftLoading === g.id} onClick={() => draftReply(g.id)} style={{ fontSize: "0.82rem" }}>
                  {draftLoading === g.id ? "Asking Gemini…" : "✨ Draft reply with AI"}
                </button>
              )}
              {g.status === "open" ? (
                <button className="btn btn-outline" onClick={() => resolve(g.id)}>Mark resolved</button>
              ) : (
                <span style={{ fontSize: "0.8rem", color: "var(--green-signal)", fontWeight: 600 }}>Resolved</span>
              )}
            </div>
          </div>
          {drafts[g.id] && (
            <p style={{ marginTop: "0.7rem", fontSize: "0.88rem", background: "var(--sandstone)", padding: "0.7rem 0.9rem", borderRadius: 8 }}>
              {drafts[g.id]}
            </p>
          )}
        </div>
      ))}
      {items?.length === 0 && <p style={{ color: "var(--ink-soft)" }}>No grievances filed.</p>}
    </div>
  );
}
