import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header style={styles.header}>
      <Link to="/" style={styles.brand}>
        <span style={styles.brandMark}>ST</span>
        <span>
          <div style={styles.brandTitle}>Adivasi Shiksha Setu</div>
          <div style={styles.brandSub}>AI-enabled ST Scholarship &amp; Fellowship System</div>
        </span>
      </Link>

      <nav style={styles.nav}>
        {user?.role === "student" && (
          <>
            <Link to="/dashboard" style={styles.link}>My applications</Link>
            <Link to="/apply" style={styles.link}>New application</Link>
            <Link to="/grievances" style={styles.link}>Grievances</Link>
          </>
        )}
        {user?.role === "officer" && (
          <>
            <Link to="/officer" style={styles.link}>Case queue</Link>
            <Link to="/officer/grievances" style={styles.link}>Grievances</Link>
          </>
        )}
        {user ? (
          <button
            className="btn btn-outline"
            style={{ borderColor: "#fff", color: "#fff" }}
            onClick={() => { logout(); navigate("/login"); }}
          >
            Sign out ({user.name.split(" ")[0]})
          </button>
        ) : (
          <>
            <Link to="/login" style={styles.link}>Sign in</Link>
            <Link to="/register" className="btn btn-accent">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}

const styles = {
  header: {
    background: "var(--forest)",
    color: "var(--white)",
    padding: "0.85rem 2rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "3px solid var(--turmeric)",
  },
  brand: { display: "flex", alignItems: "center", gap: "0.75rem", textDecoration: "none", color: "var(--white)" },
  brandMark: {
    fontFamily: "var(--serif)",
    fontWeight: 700,
    background: "var(--turmeric)",
    color: "var(--forest-deep)",
    width: "2.1rem",
    height: "2.1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "3px",
    fontSize: "0.95rem",
  },
  brandTitle: { fontFamily: "var(--serif)", fontSize: "1.05rem", fontWeight: 600 },
  brandSub: { fontSize: "0.7rem", opacity: 0.75, marginTop: "1px" },
  nav: { display: "flex", alignItems: "center", gap: "1.5rem" },
  link: { textDecoration: "none", color: "var(--white)", fontSize: "0.9rem", opacity: 0.9 },
};
