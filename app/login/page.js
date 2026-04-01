"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Invalid email or password.");
    }
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
          <p style={{ margin: "6px 0 0", color: "#6B6560", fontSize: 14 }}>Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2DDD3", padding: 28, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
          {error && <div style={{ background: "#FDE8E7", color: "#B5342B", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B6560", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #E2DDD3", borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B6560", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #E2DDD3", borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
          </div>
          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "11px", background: loading ? "#6B9E7A" : "#2D5A3D", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
