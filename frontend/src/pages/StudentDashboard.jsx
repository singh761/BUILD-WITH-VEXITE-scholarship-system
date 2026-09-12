import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { RiskPill, StatusPill } from "../components/Pills";
import { useAuth } from "../context/AuthContext";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [apps, setApps] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/applications/mine")
      .then((res) => setApps(res.data))
      .catch(() => setError("Could not load your applications right now."));
  }, []);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.8rem" }}>
        <div>
          <h2>Welcome, {user.name.split(" ")[0]}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: "0.92rem" }}>Track every scheme you've applied to, in one place.</p>
        </div>
        <Link to="/apply" className="btn btn-accent">New application</Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {apps === null && !error && <p style={{ color: "var(--ink-soft)" }}>Loading your applications…</p>}

      {apps && apps.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ marginBottom: "1.2rem" }}>You haven't submitted an application yet.</p>
          <Link to="/apply" className="btn btn-primary">Start your first application</Link>
        </div>
      )}

      {apps && apps.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Scheme</th>
                <th>Institute</th>
                <th>Amount requested</th>
                <th>AI risk</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  <td>{a.scheme}</td>
                  <td>{a.institute_name}</td>
                  <td>{a.amount_requested ? `₹${a.amount_requested.toLocaleString("en-IN")}` : "—"}</td>
                  <td><RiskPill score={a.risk_score} /></td>
                  <td><StatusPill status={a.status} /></td>
                  <td><Link to={`/applications/${a.id}`} style={{ color: "var(--slate)", fontWeight: 600, fontSize: "0.85rem" }}>View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
