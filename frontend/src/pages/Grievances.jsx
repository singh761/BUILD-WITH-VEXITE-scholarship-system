import { useEffect, useState } from "react";
import api from "../api";

export default function Grievances() {
  const [items, setItems] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get("/grievances/mine").then((res) => setItems(res.data)).catch(() => setError("Could not load grievances."));
  }
  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/grievances", { message });
      setMessage("");
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not submit grievance.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <h2 style={{ marginBottom: "0.3rem" }}>Grievances</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: "1.8rem", fontSize: "0.92rem" }}>
        Describe your issue in your own words — urgent cases (like fee deadlines) are automatically prioritized.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <form className="card" onSubmit={submit} style={{ marginBottom: "1.5rem" }}>
        <div className="field">
          <label>Your message</label>
          <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. My scholarship hasn't been disbursed and my exam fee is due tomorrow." />
        </div>
        <button className="btn btn-accent" disabled={submitting}>{submitting ? "Sending…" : "Submit grievance"}</button>
      </form>

      {items?.map((g) => (
        <div key={g.id} className="card" style={{ marginBottom: "0.9rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <span className={`status-pill ${g.priority === "High" ? "status-escalated" : ""}`}>{g.priority} priority</span>
            <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{new Date(g.created_at).toLocaleDateString("en-IN")}</span>
          </div>
          <p style={{ fontSize: "0.9rem" }}>{g.message}</p>
          <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginTop: "0.3rem" }}>Status: {g.status}</p>
        </div>
      ))}
      {items?.length === 0 && <p style={{ color: "var(--ink-soft)" }}>No grievances filed yet.</p>}
    </div>
  );
}
