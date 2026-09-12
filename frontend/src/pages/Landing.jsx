import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Landing() {
  const { user } = useAuth();

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "4rem 2rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "3rem", alignItems: "center" }}>
        <div>
          <p style={{ color: "var(--turmeric-deep)", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.75rem" }}>
            Ministry of Tribal Affairs · Pre &amp; Post-Matric, NFST, NOS
          </p>
          <h1 style={{ fontSize: "2.6rem", marginBottom: "1.1rem" }}>
            From application to disbursement, without the months of waiting.
          </h1>
          <p style={{ color: "var(--ink-soft)", fontSize: "1.05rem", maxWidth: 520 }}>
            A single portal for Scheduled Tribe students and welfare officers — AI-assisted
            document verification, transparent case tracking, and direct benefit transfer,
            built for the realities of remote and forest-belt habitations.
          </p>
          <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
            {!user && (
              <>
                <Link to="/register" className="btn btn-accent">Apply for a scholarship</Link>
                <Link to="/login" className="btn btn-outline">Officer sign in</Link>
              </>
            )}
            {user?.role === "student" && <Link to="/dashboard" className="btn btn-accent">Go to my applications</Link>}
            {user?.role === "officer" && <Link to="/officer" className="btn btn-accent">Open case queue</Link>}
          </div>
        </div>

        <div className="card" style={{ background: "var(--forest)", color: "var(--white)", border: "none" }}>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: "1.1rem", marginBottom: "1rem", color: "var(--turmeric)" }}>
            How a case moves
          </h3>
          {[
            "Multilingual registration",
            "AI OCR pre-screening",
            "Fraud & document verification",
            "Institute sign-off",
            "Direct benefit transfer",
          ].map((step, i) => (
            <div key={step} style={{ display: "flex", gap: "0.9rem", padding: "0.6rem 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.15)" : "none" }}>
              <span style={{ fontFamily: "var(--serif)", color: "var(--turmeric)", width: "1.4rem" }}>{i + 1}</span>
              <span style={{ fontSize: "0.92rem" }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
