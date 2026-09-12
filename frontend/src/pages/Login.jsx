import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GoogleSignInButton from "../components/GoogleSignInButton";

const dividerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  margin: "1.3rem 0",
  color: "var(--ink-soft)",
  fontSize: "0.8rem",
};

const lineStyle = { flex: 1, height: 1, background: "var(--sandstone-deep)" };

export default function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleCredential(credential) {
    setError("");
    try {
      // Defaults new accounts to "student" — officers should register once
      // with Google from the Register page to set their role explicitly.
      const user = await googleLogin(credential, "student");
      navigate(user.role === "officer" ? "/officer" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Google sign-in failed. Please try again.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === "officer" ? "/officer" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Could not sign in. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "3.5rem auto", padding: "0 1.5rem" }}>
      <h2 style={{ marginBottom: "0.4rem" }}>Sign in</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: "1.8rem", fontSize: "0.92rem" }}>
        Students and welfare officers use the same portal.
      </p>

      <form className="card" onSubmit={handleSubmit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label>Email</label>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div style={dividerStyle}>
          <span style={lineStyle} />
          <span>or</span>
          <span style={lineStyle} />
        </div>

        <GoogleSignInButton onCredential={handleGoogleCredential} onError={setError} />
      </form>

      <p style={{ marginTop: "1.2rem", fontSize: "0.9rem", color: "var(--ink-soft)" }}>
        New here? <Link to="/register" style={{ color: "var(--forest)", fontWeight: 600 }}>Create an account</Link>
      </p>
    </div>
  );
}
