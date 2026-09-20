"use client";
import { useState, useEffect } from "react";

const field = { width: "100%", padding: "10px 12px", border: "1px solid #E2DDD3", borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" };
const label = { display: "block", fontSize: 12, fontWeight: 600, color: "#6B6560", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 };
const button = (busy) => ({ width: "100%", padding: "11px", background: busy ? "#7FA36A" : "#476C2E", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" });

export default function ResetPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState("idle"); // idle | sent | done
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("token")) { setToken(q.get("token")); setEmail(q.get("email") || ""); }
  }, []);

  const request = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      if (!r.ok) { setError((await r.json().catch(() => ({}))).error || "Something went wrong."); return; }
      setState("sent");
    } finally { setLoading(false); }
  };

  const save = async (e) => {
    e.preventDefault(); setError("");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/reset", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, token, password }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setError(body.error || "Something went wrong."); return; }
      setState("done");
    } finally { setLoading(false); }
  };

  const card = { background: "#fff", borderRadius: 14, border: "1px solid #E2DDD3", padding: 28, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F5F0", fontFamily: "'DM Sans', sans-serif", padding: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Fraunces:wght@700&display=swap'); *{box-sizing:border-box}`}</style>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/CLEARGREEN-BADJR.png" alt="BaDjR" style={{ height: 44, display: "block", margin: "0 auto 12px" }} />
          <h1 style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", color: "#9C9590", textTransform: "uppercase" }}>Badjr-Pay</h1>
          <p style={{ margin: "6px 0 0", color: "#6B6560", fontSize: 14 }}>{token ? "Choose a new password" : "Reset your password"}</p>
        </div>

        {state === "done" ? (
          <div style={card}>
            <div style={{ background: "#E6F1DE", color: "#3F7A2E", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>Password updated. Any trusted devices were signed out.</div>
            <a href="/login" style={{ ...button(false), display: "block", textAlign: "center", textDecoration: "none" }}>Sign in</a>
          </div>
        ) : token ? (
          <form onSubmit={save} style={card}>
            {error && <div style={{ background: "#F7E5E5", color: "#8A1C1C", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
            <div style={{ marginBottom: 16 }}><label style={label}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={field} /></div>
            <div style={{ marginBottom: 16 }}><label style={label}>New password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" style={field} /></div>
            <div style={{ marginBottom: 20 }}><label style={label}>Confirm password</label><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" style={field} /></div>
            <button type="submit" disabled={loading} style={button(loading)}>{loading ? "Saving…" : "Save new password"}</button>
          </form>
        ) : state === "sent" ? (
          <div style={card}>
            <div style={{ background: "#E6F1DE", color: "#3F7A2E", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>If <b>{email}</b> has an account, a reset link is on its way. It works once and expires in 1 hour.</div>
            <a href="/login" style={{ color: "#476C2E", fontSize: 13 }}>← Back to sign in</a>
          </div>
        ) : (
          <form onSubmit={request} style={card}>
            {error && <div style={{ background: "#F7E5E5", color: "#8A1C1C", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6B6560", lineHeight: 1.5 }}>Enter your email and we'll send a link to choose a new password.</p>
            <div style={{ marginBottom: 20 }}><label style={label}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" style={field} /></div>
            <button type="submit" disabled={loading} style={button(loading)}>{loading ? "Sending…" : "Send reset link"}</button>
            <div style={{ textAlign: "center", marginTop: 16 }}><a href="/login" style={{ color: "#476C2E", fontSize: 13, textDecoration: "none" }}>← Back to sign in</a></div>
          </form>
        )}
      </div>
    </div>
  );
}
