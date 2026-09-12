import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

const SCHEMES = ["Pre-Matric", "Post-Matric", "NFST", "NOS"];

export default function NewApplication() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    scheme: "Post-Matric", institute_name: "", course: "",
    annual_income: "", bank_account: "", ifsc: "", amount_requested: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/applications", {
        ...form,
        annual_income: form.annual_income ? Number(form.annual_income) : null,
        amount_requested: form.amount_requested ? Number(form.amount_requested) : null,
      });
      navigate(`/applications/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || "Could not submit the application. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <h2 style={{ marginBottom: "0.3rem" }}>New scholarship application</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: "1.8rem", fontSize: "0.92rem" }}>
        Fill in your details below. You'll upload supporting documents on the next screen.
      </p>

      <form className="card" onSubmit={handleSubmit}>
        {error && <div className="error-banner">{error}</div>}

        <div className="field">
          <label>Scheme</label>
          <select value={form.scheme} onChange={(e) => update("scheme", e.target.value)}>
            {SCHEMES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Institute name</label>
          <input required value={form.institute_name} onChange={(e) => update("institute_name", e.target.value)} />
        </div>

        <div className="field">
          <label>Course / programme</label>
          <input value={form.course} onChange={(e) => update("course", e.target.value)} placeholder="e.g. B.Tech CSE, M.Phil History" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="field">
            <label>Annual family income (₹)</label>
            <input type="number" min="0" value={form.annual_income} onChange={(e) => update("annual_income", e.target.value)} />
          </div>
          <div className="field">
            <label>Amount requested (₹)</label>
            <input type="number" min="0" value={form.amount_requested} onChange={(e) => update("amount_requested", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="field">
            <label>Bank account number</label>
            <input value={form.bank_account} onChange={(e) => update("bank_account", e.target.value)} />
          </div>
          <div className="field">
            <label>IFSC code</label>
            <input value={form.ifsc} onChange={(e) => update("ifsc", e.target.value.toUpperCase())} />
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem" }} disabled={loading}>
          {loading ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </div>
  );
}
