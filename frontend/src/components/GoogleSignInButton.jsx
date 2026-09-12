import { useEffect, useRef } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

/**
 * Renders the official "Sign in with Google" button using Google Identity
 * Services (GIS). Calls onCredential(idToken) once the user completes the
 * Google popup — the parent is responsible for sending that token to the
 * backend's /auth/google endpoint.
 */
export default function GoogleSignInButton({ onCredential, onError, text = "signin_with" }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    function render() {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text,
        shape: "rectangular",
      });
    }

    if (window.google?.accounts?.id) {
      render();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => onError?.("Could not load Google Sign-In. Check your connection.");
    document.head.appendChild(script);

    return () => { script.onload = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", textAlign: "center" }}>
        Google sign-in isn't configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in the frontend's <code>.env</code>.
      </p>
    );
  }

  return <div ref={buttonRef} style={{ display: "flex", justifyContent: "center" }} />;
}
