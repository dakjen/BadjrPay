"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({ email: "", name: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/setup").then(r => r.json()).then(d => {
      if (!d.needsSetup) router.replace("/login");
      else setChecking(false);
    }).catch(() => setChecking(false));
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords don't match."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email, name: form.name, password: form.password }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) router.push("/login");
    else setError(data.error || "Something went wrong.");
  };

  if (checking) return null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F5F0", fontFamily: "'DM Sans', sans-serif", padding: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Fraunces:wght@700&display=swap'); *{box-sizing:border-box}`}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, background: "#2D5A3D", borderRadius: 14, marginBottom: 16 }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 700, color: "#fff" }}>B</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A" }}>Create your account</h1>
          <p style={{ margin: "6px 0 0", color: "#6B6560", fontSize: 14 }}>First-time setup for Badjr-Pay</p>
        </div>
        <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2DDD3", padding: 28, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
          {error && <div style={{ background: "#FDE8E7", color: "#B5342B", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          {[
            { label: "Full Name", key: "name", type: "text", placeholder: "Dakota Jennifer" },
            { label: "Email", key: "email", type: "email", placeholder: "you@example.com" },
            { label: "Password", key: "password", type: "password", placeholder: "At least 8 characters" },
            { label: "Confirm Password", key: "confirm", type: "password", placeholder: "••••••••" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B6560", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{f.label}</label>
              <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} required placeholder={f.placeholder}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #E2DDD3", borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
            </div>
          ))}
          <button type="submit" disabled={loading}
            style={{ width: "100%", marginTop: 8, padding: "11px", background: loading ? "#6B9E7A" : "#2D5A3D", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <p style={{ textAlign: "center", fontSize: 12, color: "#9C9590", marginTop: 16 }}>Already have an account? <a href="/login" style={{ color: "#2D5A3D", fontWeight: 600, textDecoration: "none" }}>Sign in</a></p>
      </div>
    </div>
  );
}
