"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const field = { width: "100%", padding: "10px 12px", border: "1px solid #E2DDD3", borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" };
const label = { display: "block", fontSize: 12, fontWeight: 600, color: "#6B6560", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 };
const button = (busy) => ({ width: "100%", padding: "11px", background: busy ? "#6B9E7A" : "#2D5A3D", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" });
const linkBtn = { background: "none", border: "none", color: "#2D5A3D", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 };

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState("password"); // password → code
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const finish = async (bypass) => {
    const res = await signIn("credentials", { email, password, code: bypass, redirect: false });
    if (res?.ok) { router.push("/"); router.refresh(); }
    else setError("Sign-in didn't complete. Please try again.");
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setError(""); setNotice(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setError(body.error || "Invalid email or password."); return; }
      if (body.bypass) { await finish(body.bypass); return; }   // trusted device — no code needed
      setSentTo(body.to || email); setStep("code");
    } catch { setError("Couldn't reach the server. Check your connection."); }
    finally { setLoading(false); }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/2fa", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, code, remember }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setError(body.error || "That code isn't right."); return; }
      await finish(body.bypass);
    } catch { setError("Couldn't reach the server. Check your connection."); }
    finally { setLoading(false); }
  };

  const resend = async () => {
    setError(""); setNotice(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const body = await r.json().catch(() => ({}));
      if (r.ok) { setCode(""); setNotice(`A new code was sent to ${body.to || email}.`); } else setError(body.error || "Couldn't resend the code.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F5F0", fontFamily: "'DM Sans', sans-serif", padding: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Fraunces:wght@700&display=swap'); *{box-sizing:border-box}`}</style>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, background: "#2D5A3D", borderRadius: 14, marginBottom: 16 }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 700, color: "#fff" }}>B</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A" }}>Badjr-Pay</h1>
          <p style={{ margin: "6px 0 0", color: "#6B6560", fontSize: 14 }}>{step === "code" ? "Check your email" : "Sign in to your account"}</p>
        </div>

        {step === "password" ? (
          <form onSubmit={submitPassword} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2DDD3", padding: 28, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
            {error && <div style={{ background: "#FDE8E7", color: "#B5342B", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" style={field} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={label}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" style={field} />
            </div>
            <button type="submit" disabled={loading} style={button(loading)}>{loading ? "Checking…" : "Continue"}</button>
            <div style={{ textAlign: "center", marginTop: 16 }}><a href="/reset" style={{ ...linkBtn, textDecoration: "none" }}>Forgot your password?</a></div>
          </form>
        ) : (
          <form onSubmit={submitCode} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2DDD3", padding: 28, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
            {error && <div style={{ background: "#FDE8E7", color: "#B5342B", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
            {notice && <div style={{ background: "#E3F5EC", color: "#2D7A4F", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{notice}</div>}
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6B6560", lineHeight: 1.5 }}>We emailed a 6-digit code to <b>{sentTo}</b>. It expires in 10 minutes.</p>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Sign-in code</label>
              <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus placeholder="123456"
                style={{ ...field, fontSize: 22, letterSpacing: "0.3em", textAlign: "center", fontFamily: "'Courier New', monospace" }} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1A1A1A", marginBottom: 20, cursor: "pointer" }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Trust this device for 30 days
            </label>
            <button type="submit" disabled={loading || code.length !== 6} style={button(loading || code.length !== 6)}>{loading ? "Verifying…" : "Sign In"}</button>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
              <button type="button" onClick={() => { setStep("password"); setCode(""); setError(""); setNotice(""); }} style={linkBtn}>← Back</button>
              <button type="button" onClick={resend} disabled={loading} style={linkBtn}>Resend code</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
