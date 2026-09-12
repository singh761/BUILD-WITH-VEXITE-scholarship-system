import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { RiskPill, StatusPill } from "../components/Pills";

export default function OfficerDashboard() {
  const [apps, setApps] = useState(null);
  const [summary, setSummary] = useState(null);
  const [riskFilter, setRiskFilter] = useState("");
  const [error, setError] = useState("");

  function load() {
    const params = riskFilter ? { risk: riskFilter } : {};
    api.get("/officer/applications", { params })
      .then((res) => setApps(res.data))
      .catch(() => setError("Could not load the case queue."));
    api.get("/officer/summary").then((res) => setSummary(res.data)).catch(() => {});
  }

  useEffect(load, [riskFilter]);

  const riskCounts = { Green: 0, Yellow: 0, Red: 0 };
  summary?.byRisk?.forEach((r) => { riskCounts[r.risk_score] = r.count; });

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <h2 style={{ marginBottom: "0.3rem" }}>Case queue</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: "1.8rem", fontSize: "0.92rem" }}>
        Sorted so the applications needing the most attention surface first.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.8rem" }}>
        <SummaryCard label="High-risk (Red)" value={riskCounts.Red} accent="var(--red-signal)" onClick={() => setRiskFilter("Red")} active={riskFilter === "Red"} />
        <SummaryCard label="Needs review (Yellow)" value={riskCounts.Yellow} accent="var(--yellow-signal)" onClick={() => setRiskFilter("Yellow")} active={riskFilter === "Yellow"} />
        <SummaryCard label="Auto-verified (Green)" value={riskCounts.Green} accent="var(--green-signal)" onClick={() => setRiskFilter("Green")} active={riskFilter === "Green"} />
        <SummaryCard label="Total disbursed" value={summary ? `₹${summary.totalDisbursed.toLocaleString("en-IN")}` : "—"} accent="var(--forest)" />
      </div>

      {riskFilter && (
        <button className="btn btn-outline" style={{ marginBottom: "1rem" }} onClick={() => setRiskFilter("")}>
          Clear filter ({riskFilter})
        </button>
      )}

      {error && <div className="error-banner">{error}</div>}

      {apps && apps.length === 0 && <p style={{ color: "var(--ink-soft)" }}>No applications match this filter.</p>}

      {apps && apps.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Scheme</th>
                <th>Tribe / District</th>
                <th>AI risk</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  <td>{a.student_name}</td>
                  <td>{a.scheme}</td>
                  <td>{a.tribe || "—"} / {a.district || "—"}</td>
                  <td><RiskPill score={a.risk_score} /></td>
                  <td><StatusPill status={a.status} /></td>
                  <td><Link to={`/applications/${a.id}`} style={{ color: "var(--slate)", fontWeight: 600, fontSize: "0.85rem" }}>Review →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent, onClick, active }) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        borderLeft: `4px solid ${accent}`,
        borderColor: active ? accent : undefined,
        background: active ? "var(--sandstone-deep)" : "var(--white)",
      }}
    >
      <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginBottom: "0.4rem" }}>{label}</div>
      <div style={{ fontFamily: "var(--serif)", fontSize: "1.6rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}
