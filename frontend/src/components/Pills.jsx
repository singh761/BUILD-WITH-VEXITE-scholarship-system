export function RiskPill({ score }) {
  if (!score) return <span className="risk-pill" style={{ background: "#eee", color: "#888" }}>Pending</span>;
  return <span className={`risk-pill risk-${score}`}>{score}</span>;
}

export function StatusPill({ status }) {
  const label = status
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
  return <span className={`status-pill status-${status}`}>{label}</span>;
}
