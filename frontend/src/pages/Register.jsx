import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GoogleSignInButton from "../components/GoogleSignInButton";

const INDIAN_STATES = [
  "Madhya Pradesh", "Odisha", "Jharkhand", "Chhattisgarh", "Maharashtra",
  "Gujarat", "Rajasthan", "Andhra Pradesh", "Telangana", "West Bengal", "Assam", "Other",
];

const dividerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  margin: "1.3rem 0",
  color: "var(--ink-soft)",
  fontSize: "0.8rem",
};
const lineStyle = { flex: 1, height: 1, background: "var(--sandstone-deep)" };

export default function Register() {
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    role: "student", name: "", email: "", password: "",
    phone: "", tribe: "", district: "", state: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleCredential(credential) {
    setError("");
    try {
      // Uses whichever role is selected above — only applied if this Google
      // account is signing up for the first time.
      const user = await googleLogin(credential, form.role);
      navigate(user.role === "officer" ? "/officer" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Google sign-in failed. Please try again.");
    }
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await register(form);
      navigate(user.role === "officer" ? "/officer" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed. Please check the form and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "3rem auto", padding: "0 1.5rem" }}>
      <h2 style={{ marginBottom: "0.4rem" }}>Create an account</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: "1.8rem", fontSize: "0.92rem" }}>
        Register as a student to apply for a scheme, or as a welfare officer to review cases.
      </p>

      <form className="card" onSubmit={handleSubmit}>
        {error && <div className="error-banner">{error}</div>}

        <div className="field">
          <label>I am registering as</label>
          <select value={form.role} onChange={(e) => update("role", e.target.value)}>
            <option value="student">A student / applicant</option>
            <option value="officer">A nodal / welfare officer</option>
          </select>
        </div>

        <div style={{ margin: "1.2rem 0" }}>
          <GoogleSignInButton onCredential={handleGoogleCredential} onError={setError} text="signup_with" />
        </div>
        <div style={dividerStyle}>
          <span style={lineStyle} />
          <span>or register with email</span>
          <span style={lineStyle} />
        </div>

        <div className="field">
          <label>Full name</label>
          <input required value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>

        <div className="field">
          <label>Email</label>
          <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>

        <div className="field">
          <label>Password</label>
          <input type="password" required minLength={6} value={form.password} onChange={(e) => update("password", e.target.value)} />
        </div>

        <div className="field">
          <label>Phone (optional)</label>
          <input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </div>

        {form.role === "student" && (
          <>
            <div className="field">
              <label>Tribe / community</label>
              <input value={form.tribe} onChange={(e) => update("tribe", e.target.value)} placeholder="e.g. Gond, Bhil, Santhal" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="field">
                <label>District</label>
                <input value={form.district} onChange={(e) => update("district", e.target.value)} />
              </div>
              <div className="field">
                <label>State</label>
                <select value={form.state} onChange={(e) => update("state", e.target.value)}>
                  <option value="">Select</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        <button className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem" }} disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p style={{ marginTop: "1.2rem", fontSize: "0.9rem", color: "var(--ink-soft)" }}>
        Already registered? <Link to="/login" style={{ color: "var(--forest)", fontWeight: 600 }}>Sign in</Link>
      </p>
    </div>
  );
}
