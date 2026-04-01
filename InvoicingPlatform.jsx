import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}


// ─── Fonts (loaded safely) ───
let fontsLoaded = false;
function loadFonts() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  try {
    const fontLink = document.createElement("link");
    fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&display=swap";
    fontLink.rel = "stylesheet";
    document.head.appendChild(fontLink);
  } catch(e) {}
}

const theme = {
  bg: "#F7F5F0", surface: "#FFFFFF", surfaceAlt: "#F0EDE6",
  border: "#E2DDD3", borderLight: "#EDE9E1",
  text: "#1A1A1A", textSecondary: "#6B6560", textMuted: "#9C9590",
  accent: "#2D5A3D", accentLight: "#E8F0EB", accentHover: "#1F4A2F",
  warning: "#C4841D", warningLight: "#FFF4E5",
  danger: "#B5342B", dangerLight: "#FDE8E7",
  success: "#2D7A4F", successLight: "#E3F5EC",
  blue: "#2B5EA7", blueLight: "#E8F0FB",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
  shadowLg: "0 10px 30px rgba(0,0,0,0.1)",
  radius: "10px", radiusSm: "6px", radiusLg: "14px",
};

const genId = () => Math.random().toString(36).substr(2, 9);
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const fmtDate = (d) => { const [y, m, day] = String(d).split("T")[0].split("-"); return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const today = () => new Date().toISOString().split("T")[0];

const defaultData = {
  clients: [],
  categories: [],
  services: [], projects: [], invoices: [],
  settings: { companyName: "", companyAddress: "", companyPhone: "" },
};

// ═══════════════════════════════════════
// ICONS
// ═══════════════════════════════════════
const Icons = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  invoice: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  project: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  service: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  category: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  send: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  trash: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  edit: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  dollar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  eye: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  user: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  mail: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  report: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  spinner: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
};

// ═══════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════
function StatusBadge({ status }) {
  const styles = { draft: { bg: theme.surfaceAlt, color: theme.textSecondary, label: "Draft" }, sent: { bg: theme.blueLight, color: theme.blue, label: "Sent" }, viewed: { bg: theme.warningLight, color: theme.warning, label: "Viewed" }, paid: { bg: theme.successLight, color: theme.success, label: "Paid" }, overdue: { bg: theme.dangerLight, color: theme.danger, label: "Overdue" }, partial: { bg: theme.warningLight, color: theme.warning, label: "Partial" }, active: { bg: theme.accentLight, color: theme.accent, label: "Active" }, completed: { bg: theme.successLight, color: theme.success, label: "Completed" }, archived: { bg: theme.surfaceAlt, color: theme.textMuted, label: "Archived" } };
  const s = styles[status] || styles.draft;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color, letterSpacing: "0.02em", fontFamily: "'DM Sans', sans-serif" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, opacity: 0.7 }} />{s.label}</span>;
}

function Btn({ children, onClick, variant = "primary", size = "md", icon, style: sx, disabled, ...props }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, borderRadius: theme.radiusSm, transition: "all 0.15s ease", whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1 };
  const sizes = { sm: { padding: "6px 12px", fontSize: 12 }, md: { padding: "8px 16px", fontSize: 13 }, lg: { padding: "10px 20px", fontSize: 14 } };
  const variants = { primary: { background: theme.accent, color: "#fff" }, secondary: { background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}` }, ghost: { background: "transparent", color: theme.textSecondary }, danger: { background: theme.dangerLight, color: theme.danger }, success: { background: theme.successLight, color: theme.success }, blue: { background: theme.blueLight, color: theme.blue } };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...sx }} {...props}>{icon}{children}</button>;
}

function Input({ label, ...props }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{label && <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{label}</label>}<input {...props} style={{ padding: "8px 12px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", background: theme.surface, color: theme.text, ...props.style }} onFocus={e => e.target.style.borderColor = theme.accent} onBlur={e => e.target.style.borderColor = theme.border} /></div>;
}

function Select({ label, children, ...props }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{label && <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{label}</label>}<select {...props} style={{ padding: "8px 12px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", background: theme.surface, color: theme.text, cursor: "pointer", ...props.style }}>{children}</select></div>;
}

function Textarea({ label, ...props }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{label && <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{label}</label>}<textarea {...props} style={{ padding: "8px 12px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", background: theme.surface, color: theme.text, resize: "vertical", minHeight: 60, ...props.style }} /></div>;
}

function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  return <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} onClick={onClose}><div onClick={e => e.stopPropagation()} style={{ background: theme.surface, borderRadius: `${theme.radiusLg} ${theme.radiusLg} 0 0`, width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto", boxShadow: theme.shadowLg, animation: "modalIn 0.2s ease" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${theme.borderLight}` }}><h3 style={{ margin: 0, fontSize: 16, fontFamily: "'Fraunces', serif", fontWeight: 600, color: theme.text }}>{title}</h3><button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, padding: 4 }}>{Icons.close}</button></div><div style={{ padding: "20px" }}>{children}</div></div></div>;
}

function StatCard({ label, value, icon, color = theme.accent }) {
  return <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px 20px", border: `1px solid ${theme.borderLight}`, flex: "1 1 180px", minWidth: 160 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div><div style={{ fontSize: 22, fontWeight: 700, color: theme.text, fontFamily: "'Fraunces', serif" }}>{value}</div></div><div style={{ color, opacity: 0.6 }}>{icon}</div></div></div>;
}

function Empty({ icon, message, action }) {
  return <div style={{ textAlign: "center", padding: "48px 20px", color: theme.textMuted }}><div style={{ opacity: 0.3, marginBottom: 12, display: "flex", justifyContent: "center" }}>{icon}</div><div style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>{message}</div>{action}</div>;
}

function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: { bg: theme.successLight, color: theme.success, border: "#b8e0ca" }, error: { bg: theme.dangerLight, color: theme.danger, border: "#f5c6c3" }, info: { bg: theme.blueLight, color: theme.blue, border: "#c3d9f5" } };
  const c = colors[type] || colors.success;
  return <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "12px 20px", borderRadius: theme.radiusSm, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", boxShadow: theme.shadowMd, animation: "modalIn 0.2s ease", display: "flex", alignItems: "center", gap: 8, maxWidth: 400 }}>{type === "success" && Icons.check}{message}<button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: c.color, marginLeft: 8, padding: 0 }}>{Icons.close}</button></div>;
}

// ═══════════════════════════════════════
// PDF GENERATION (jsPDF loaded from CDN)
// ═══════════════════════════════════════
let jspdfLoaded = false;
function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf) { resolve(); return; }
    if (jspdfLoaded) {
      let attempts = 0;
      const check = setInterval(() => {
        if (window.jspdf) { clearInterval(check); resolve(); }
        else if (++attempts > 100) { clearInterval(check); reject(new Error("jsPDF failed to load")); }
      }, 50);
      return;
    }
    jspdfLoaded = true;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load PDF library — check your internet connection"));
    document.head.appendChild(s);
  });
}

async function generateInvoicePDF(invoice, settings, client) {
  await loadJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const W = 210, margin = 20, cW = W - margin * 2;
  let y = 20;
  const A = [45, 90, 61], D = [26, 26, 26], G = [107, 101, 96], L = [237, 233, 225];

  // Header bar
  doc.setFillColor(...A);
  doc.rect(0, 0, W, 44, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text(settings.companyName || "INVOICE", margin, 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  if (settings.companyAddress) doc.text(settings.companyAddress, margin, 28);
  if (settings.companyPhone) doc.text(settings.companyPhone, margin, 34);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(invoice.number || "INV-0001", W - margin, 20, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Issued: ${invoice.createdAt ? fmtDate(invoice.createdAt) : "-"}`, W - margin, 28, { align: "right" });
  doc.text(`Due: ${invoice.dueDate ? fmtDate(invoice.dueDate) : "-"}`, W - margin, 34, { align: "right" });
  if (invoice.status === "paid") doc.text(`Paid: ${invoice.paidAt ? fmtDate(invoice.paidAt) : "Yes"}`, W - margin, 40, { align: "right" });

  y = 58;
  doc.setTextColor(...G); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("BILL TO", margin, y); y += 6;
  doc.setTextColor(...D); doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text(invoice.clientName || "-", margin, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...G);
  if (client?.email) { doc.text(client.email, margin, y); y += 4.5; }
  if (client?.phone) { doc.text(client.phone, margin, y); y += 4.5; }
  if (client?.address) { client.address.split("\n").forEach(l => { doc.text(l.trim(), margin, y); y += 4.5; }); }

  y += 8;
  // Table header
  doc.setFillColor(...L); doc.rect(margin, y, cW, 8, "F");
  doc.setTextColor(...G); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", margin + 3, y + 5.5);
  doc.text("QTY", margin + cW * 0.58, y + 5.5);
  doc.text("RATE", margin + cW * 0.72, y + 5.5);
  doc.text("AMOUNT", margin + cW - 3, y + 5.5, { align: "right" });
  y += 12;

  // Line items
  doc.setTextColor(...D); doc.setFontSize(9.5); doc.setFont("helvetica", "normal");
  (invoice.items || []).forEach(li => {
    if (y > 260) { doc.addPage(); y = 20; }
    const t = (parseFloat(li.qty) || 0) * (parseFloat(li.rate) || 0);
    const desc = doc.splitTextToSize(li.description || "", cW * 0.54);
    doc.text(desc, margin + 3, y);
    doc.text(String(li.qty || 0), margin + cW * 0.58, y);
    doc.text(fmt(li.rate || 0), margin + cW * 0.72, y);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(t), margin + cW - 3, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    const lineH = Math.max(desc.length * 4.5, 7);
    y += lineH;
    doc.setDrawColor(...L); doc.line(margin, y - 1.5, margin + cW, y - 1.5);
  });

  y += 8;
  const tX = margin + cW * 0.58;
  doc.setTextColor(...G); doc.setFontSize(9.5);
  doc.text("Subtotal", tX, y);
  doc.setTextColor(...D); doc.text(fmt(invoice.total || 0), margin + cW - 3, y, { align: "right" });
  y += 6;
  if ((invoice.amountPaid || 0) > 0) {
    doc.setTextColor(45, 122, 79);
    doc.text("Amount Paid", tX, y);
    doc.text(`-${fmt(invoice.amountPaid)}`, margin + cW - 3, y, { align: "right" });
    y += 6;
  }
  doc.setDrawColor(...D); doc.setLineWidth(0.5); doc.line(tX, y - 1, margin + cW, y - 1);
  y += 5;
  doc.setTextColor(...D); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  const remaining = (invoice.total || 0) - (invoice.amountPaid || 0);
  doc.text("TOTAL DUE", tX, y);
  doc.text(fmt(remaining), margin + cW - 3, y, { align: "right" });
  y += 14;

  if (invoice.notes) {
    doc.setFillColor(247, 245, 240);
    const noteLines = doc.splitTextToSize(invoice.notes, cW - 8);
    const boxH = 14 + noteLines.length * 4;
    doc.roundedRect(margin, y, cW, boxH, 2, 2, "F");
    doc.setTextColor(...G); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    doc.text("NOTES", margin + 4, y + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...D);
    doc.text(noteLines, margin + 4, y + 11);
  }

  // Paid stamp
  if (invoice.status === "paid") {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.15 }));
    doc.setTextColor(45, 122, 79); doc.setFontSize(48); doc.setFont("helvetica", "bold");
    doc.text("PAID", W / 2, 150, { align: "center", angle: 25 });
    doc.restoreGraphicsState();
  }

  // Footer
  doc.setTextColor(...G); doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.text("Thank you for your business.", W / 2, 282, { align: "center" });

  const pdfBase64 = doc.output("datauristring").split(",")[1];
  const pdfBlob = doc.output("blob");
  const pdfUrl = URL.createObjectURL(pdfBlob);
  return { pdfBase64, pdfBlob, pdfUrl, filename: `${(invoice.number || "invoice").replace(/\s/g, "_")}.pdf` };
}

// ═══════════════════════════════════════
// SENDGRID EMAIL
// ═══════════════════════════════════════
async function sendInvoiceEmail({ apiKey, senderEmail, senderName, recipientEmail, recipientName, subject, htmlBody, pdfBase64, filename, templateId, templateData }) {
  const payload = {
    personalizations: [{ to: [{ email: recipientEmail, name: recipientName || "" }], ...(templateId ? { dynamic_template_data: templateData || {} } : { subject }) }],
    from: { email: senderEmail, name: senderName || senderEmail },
    ...(templateId ? { template_id: templateId } : { subject, content: [{ type: "text/html", value: htmlBody }] }),
  };
  if (pdfBase64) {
    payload.attachments = [{ content: pdfBase64, filename: filename || "invoice.pdf", type: "application/pdf", disposition: "attachment" }];
  }
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response.status === 202 || response.status === 200) return { success: true };
  const err = await response.text();
  return { success: false, error: err };
}

const SENDGRID_TEMPLATES = {
  newInvoice: "d-7658bab4c4754dcc9e0911abd0c00292",
  invoiceSubmitted: "d-f4e6842af6984995b750f2ec1080e96b",
  overdue: "d-9c92a70047764baca712e91799b46761",
};

function escHtml(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function buildInvoiceEmailHTML(invoice, settings) {
  const remaining = (invoice.total || 0) - (invoice.amountPaid || 0);
  const amount = fmt(remaining).replace("$", "");
  const clientName = escHtml(invoice.clientName || "");
  const senderName = escHtml(settings.senderName || settings.companyName || "");
  const invoiceNumber = escHtml(invoice.number || "");
  const dueDate = invoice.dueDate ? fmtDate(invoice.dueDate) : "—";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>You Have a New Invoice</title></head>
<body style="margin:0;padding:0;background-color:#fffcf0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fffcf0;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #f0dda0;">
        <tr>
          <td style="background-color:#ffbd5a;padding:24px 32px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td><img src="http://cdn.mcauto-images-production.sendgrid.net/f8d2c7355b303d55/82641b9b-83c5-474f-8b4e-886864a4caff/1000x509.png" alt="BaDjR" width="200" height="100" style="display:block;border:0;border-radius:8px;" /></td>
                <td align="right"><span style="font-size:11px;font-weight:600;color:#0b2d65;background-color:rgba(11,45,101,0.12);padding:4px 12px;border-radius:20px;letter-spacing:0.08em;text-transform:uppercase;">New Invoice</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="margin:0 0 8px;font-size:15px;color:#363636;line-height:1.6;">Hi <strong>${clientName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#363636;line-height:1.6;">You've received a new invoice from <strong>${senderName}</strong>. Please review the details below:</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e9e9e9;margin-bottom:16px;"><tr><td></td></tr></table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr><td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">Invoice #</td><td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">${invoiceNumber}</td></tr>
              <tr><td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">From</td><td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">${senderName}</td></tr>
              <tr><td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">Amount Due</td><td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">$${amount}</td></tr>
              <tr><td style="font-size:13px;color:#888888;padding:8px 0;">Due Date</td><td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;">${dueDate}</td></tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e9e9e9;margin:24px 0;"><tr><td></td></tr></table>
            <p style="margin:0 0 24px;font-size:15px;color:#363636;line-height:1.6;">A PDF copy of your invoice is attached for your records. If you have any questions, please reach out to ${senderName} directly.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#fffcf0;border-top:1px solid #e9e9e9;padding:16px 32px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="font-size:13px;color:#476c2e;font-weight:600;">BaDjR Invoicing Platform</td>
                <td align="right" style="font-size:11px;color:#888888;">badjrtech.com</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function buildOverdueEmailHTML(invoice, settings) {
  const remaining = (invoice.total || 0) - (invoice.amountPaid || 0);
  const amount = fmt(remaining).replace("$", "");
  const clientName = escHtml(invoice.clientName || "");
  const senderName = escHtml(settings.senderName || settings.companyName || "");
  const invoiceNumber = escHtml(invoice.number || "");
  const dueDate = invoice.dueDate ? fmtDate(invoice.dueDate) : "—";
  const daysOverdue = invoice.dueDate
    ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / 86400000))
    : 0;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Invoice Overdue — Action Required</title></head>
<body style="margin:0;padding:0;background-color:#fffcf0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fffcf0;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #c5cfe0;">
        <tr>
          <td style="background-color:#0b2d65;padding:24px 32px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td><img src="http://cdn.mcauto-images-production.sendgrid.net/f8d2c7355b303d55/71ea8845-3525-4139-9694-41c5c14433f9/1021x595.png" alt="BaDjR" width="200" height="100" style="display:block;border:0;border-radius:8px;" /></td>
                <td align="right"><span style="font-size:11px;font-weight:600;color:#ffffff;background-color:rgba(255,255,255,0.2);padding:4px 12px;border-radius:20px;letter-spacing:0.08em;text-transform:uppercase;">Overdue</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="margin:0 0 8px;font-size:15px;color:#363636;line-height:1.6;">Hi <strong>${clientName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#363636;line-height:1.6;">This is a notice that your invoice from <strong>${senderName}</strong> is now <strong>${daysOverdue} days past due</strong>. Please arrange payment at your earliest convenience.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
              <tr><td style="background-color:#fff0f0;border-left:3px solid #e05555;border-radius:0 6px 6px 0;padding:12px 16px;font-size:13px;color:#7a1f1f;">Invoice #${invoiceNumber} — $${amount} was due on ${dueDate} (${daysOverdue} days ago)</td></tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e9e9e9;margin-bottom:16px;"><tr><td></td></tr></table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr><td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">Invoice #</td><td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">${invoiceNumber}</td></tr>
              <tr><td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">From</td><td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">${senderName}</td></tr>
              <tr><td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">Amount Due</td><td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">$${amount}</td></tr>
              <tr><td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">Original Due Date</td><td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">${dueDate}</td></tr>
              <tr><td style="font-size:13px;color:#888888;padding:8px 0;">Days Overdue</td><td align="right" style="font-size:13px;color:#e05555;font-weight:600;padding:8px 0;">${daysOverdue} days</td></tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e9e9e9;margin:24px 0;"><tr><td></td></tr></table>
            <p style="margin:0 0 24px;font-size:13px;color:#888888;line-height:1.6;">If you've already submitted payment, please disregard this message. Otherwise, please pay as soon as possible to avoid any further delays.</p>
            <p style="margin:20px 0 0;font-size:13px;color:#888888;line-height:1.6;">Questions? Contact ${senderName} directly.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#fffcf0;border-top:1px solid #e9e9e9;padding:16px 32px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="font-size:13px;color:#476c2e;font-weight:600;">BaDjR Invoicing Platform</td>
                <td align="right" style="font-size:11px;color:#888888;">badjrtech.com</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function buildSenderConfirmationHTML(invoice, settings) {
  const remaining = (invoice.total || 0) - (invoice.amountPaid || 0);
  const sentDate = fmtDate(today());
  const dueDate = invoice.dueDate ? fmtDate(invoice.dueDate) : "—";
  const senderName = escHtml(settings.senderName || settings.companyName || "there");
  const invoiceNumber = escHtml(invoice.number || "");
  const clientName = escHtml(invoice.clientName || "—");
  const amount = fmt(remaining).replace("$", "");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Invoice Submitted Successfully</title></head>
<body style="margin:0;padding:0;background-color:#fffcf0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fffcf0;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #d0dcc6;">
        <tr>
          <td style="background-color:#476c2e;padding:24px 32px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:2px;">BADJR</td>
                <td align="right"><span style="font-size:11px;font-weight:600;color:#ffffff;background-color:rgba(255,255,255,0.2);padding:4px 12px;border-radius:20px;letter-spacing:0.08em;text-transform:uppercase;">Invoicing Platform</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="margin:0 0 8px;font-size:15px;color:#363636;line-height:1.6;">Hi <strong>${senderName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#363636;line-height:1.6;">Your invoice has been submitted successfully. Here's a summary of what was sent:</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e9e9e9;margin-bottom:16px;"><tr><td></td></tr></table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">Invoice #</td>
                <td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">Client</td>
                <td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">${clientName}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">Amount Due</td>
                <td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">$${amount}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">Date Sent</td>
                <td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">${sentDate}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#888888;padding:8px 0;">Due Date</td>
                <td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;">${dueDate}</td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e9e9e9;margin:24px 0;"><tr><td></td></tr></table>
            <p style="margin:0 0 24px;font-size:15px;color:#363636;line-height:1.6;">You'll receive another notification once the client views or pays the invoice. Track its status anytime from your dashboard.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#fffcf0;border-top:1px solid #e9e9e9;padding:16px 32px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#476c2e;font-weight:700;letter-spacing:1px;">BaDjR Tech</td>
                <td align="right" style="font-size:11px;color:#888888;">badjrtech.com</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ═══════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════
export default function InvoicingPlatform() {
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const [data, setData] = useState(defaultData);
  const [page, setPage] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [toast, setToast] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    loadFonts();
    fetch("/api/data").then(r => r.ok ? r.json() : null).then(saved => {
      if (saved && Object.keys(saved).length > 0) {
        setData({ ...defaultData, ...saved, settings: { ...defaultData.settings, ...(saved.settings || {}) } });
      }
    }).catch(() => {});
  }, []);

  const persistData = (newData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newData) })
        .then(r => { if (!r.ok) showToast("Changes couldn't be saved — check your database connection", "error"); })
        .catch(() => showToast("Changes couldn't be saved — check your database connection", "error"));
    }, 800);
  };

  const update = (key, val) => setData(d => { const newData = { ...d, [key]: val }; persistData(newData); return newData; });
  const showToast = (message, type = "success") => setToast({ message, type });

  const totalRevenue = data.invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total || 0), 0);
  const outstanding = data.invoices.filter(i => ["sent", "viewed", "partial"].includes(i.status)).reduce((s, i) => s + ((i.total || 0) - (i.amountPaid || 0)), 0);
  const overdueCount = data.invoices.filter(i => i.status === "overdue").length;
  const draftCount = data.invoices.filter(i => i.status === "draft").length;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Icons.dashboard },
    { id: "invoices", label: "Invoices", icon: Icons.invoice },
    { id: "clients", label: "Clients", icon: Icons.user },
    { id: "projects", label: "Projects", icon: Icons.project },
    { id: "services", label: "Services", icon: Icons.service },
    { id: "categories", label: "Categories", icon: Icons.category },
    { id: "reports", label: "Reports", icon: Icons.report },
    { id: "users", label: "Users", icon: Icons.user },
    { id: "settings", label: "Settings", icon: Icons.settings },
  ];

  // CRUD
  const saveClient = (cl) => { if (cl.id) update("clients", data.clients.map(c => c.id === cl.id ? cl : c)); else update("clients", [...data.clients, { ...cl, id: genId() }]); setModal(null); setEditItem(null); };
  const deleteClient = (id) => update("clients", data.clients.filter(c => c.id !== id));
  const saveCategory = (cat) => { if (cat.id) update("categories", data.categories.map(c => c.id === cat.id ? cat : c)); else update("categories", [...data.categories, { ...cat, id: genId() }]); setModal(null); setEditItem(null); };
  const deleteCategory = (id) => update("categories", data.categories.filter(c => c.id !== id));
  const saveService = (svc) => { if (svc.id) update("services", data.services.map(s => s.id === svc.id ? svc : s)); else update("services", [...data.services, { ...svc, id: genId() }]); setModal(null); setEditItem(null); };
  const deleteService = (id) => update("services", data.services.filter(s => s.id !== id));
  const saveProject = (proj) => { if (proj.id) update("projects", data.projects.map(p => p.id === proj.id ? proj : p)); else update("projects", [...data.projects, { ...proj, id: genId(), status: "active", createdAt: today() }]); setModal(null); setEditItem(null); };
  const deleteProject = (id) => update("projects", data.projects.filter(p => p.id !== id));
  const saveInvoice = (inv) => {
    const total = (inv.items || []).reduce((s, li) => s + ((parseFloat(li.qty) || 0) * (parseFloat(li.rate) || 0)), 0);
    const newInv = { ...inv, total, updatedAt: today() };
    if (inv.id) update("invoices", data.invoices.map(i => i.id === inv.id ? newInv : i));
    else { const num = `INV-${String(data.invoices.length + 1).padStart(4, "0")}`; update("invoices", [...data.invoices, { ...newInv, id: genId(), number: num, status: "draft", amountPaid: 0, createdAt: today() }]); }
    setModal(null); setEditItem(null);
  };

  const updateInvoiceStatus = (id, status) => update("invoices", data.invoices.map(i => i.id === id ? { ...i, status, ...(status === "sent" ? { sentAt: today() } : {}), ...(status === "paid" ? { amountPaid: i.total, paidAt: today() } : {}) } : i));

  const markPartialPayment = (id, amount) => update("invoices", data.invoices.map(i => {
    if (i.id !== id) return i;
    const newPaid = (i.amountPaid || 0) + amount;
    return { ...i, amountPaid: newPaid, status: newPaid >= i.total ? "paid" : "partial", ...(newPaid >= i.total ? { paidAt: today() } : {}) };
  }));

  const deleteInvoice = (id) => update("invoices", data.invoices.filter(i => i.id !== id));

  const markInstallmentPaid = (invoiceId, installmentId) => {
    const today_ = today();
    update("invoices", data.invoices.map(inv => {
      if (inv.id !== invoiceId) return inv;
      const installments = (inv.installments || []).map(inst =>
        inst.id === installmentId ? { ...inst, status: "paid", paidAt: today_ } : inst
      );
      const amountPaid = installments.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
      const allPaid = installments.length > 0 && installments.every(i => i.status === "paid");
      return { ...inv, installments, amountPaid, status: allPaid ? "paid" : amountPaid > 0 ? "partial" : inv.status };
    }));
  };
  const saveSettings = (s) => { update("settings", s); showToast("Settings saved"); };

  // PDF + Email handlers
  const handleDownloadPDF = async (inv) => {
    const client = { email: inv.clientEmail, phone: inv.clientPhone, address: inv.clientAddress };
    try {
      const { pdfUrl, filename } = await generateInvoicePDF(inv, data.settings, client);
      const a = document.createElement("a"); a.href = pdfUrl; a.download = filename; a.click();
      showToast(`Downloaded ${filename}`);
    } catch (e) { showToast("Failed to generate PDF", "error"); }
  };

  const sendEmail = (body) => fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());

  const handleSendEmail = async (inv) => {
    if (!inv.clientEmail) { showToast("This invoice has no client email. Edit the invoice to add one.", "error"); return; }
    try {
      const client = { email: inv.clientEmail, phone: inv.clientPhone, address: inv.clientAddress };
      const { pdfBase64, filename } = await generateInvoicePDF(inv, data.settings, client);
      const senderName = data.settings.companyName || "BaDjR Tech";
      const result = await sendEmail({
        recipientEmail: inv.clientEmail, recipientName: inv.clientName,
        subject: `Invoice #${inv.number} from ${senderName}`,
        htmlBody: buildInvoiceEmailHTML(inv, data.settings),
        pdfBase64, filename,
      });
      if (result.success) {
        updateInvoiceStatus(inv.id, "sent");
        showToast(`Invoice emailed to ${inv.clientEmail}`);
      } else showToast(`Email failed: ${result.error || "check SENDER_EMAIL env var"}`, "error");
    } catch (e) { showToast(`Email error: ${e.message}`, "error"); }
  };

  const handleSendOverdue = async (inv) => {
    if (!inv.clientEmail) { showToast("This invoice has no client email. Edit the invoice to add one.", "error"); return; }
    try {
      const senderName = data.settings.companyName || "BaDjR Tech";
      const result = await sendEmail({
        recipientEmail: inv.clientEmail, recipientName: inv.clientName,
        subject: `Payment Reminder: Invoice #${inv.number} from ${senderName}`,
        htmlBody: buildOverdueEmailHTML(inv, data.settings),
      });
      if (result.success) showToast(`Overdue reminder sent to ${inv.clientEmail}`);
      else showToast(`Reminder failed: ${result.error || "check SENDER_EMAIL env var"}`, "error");
    } catch (e) { showToast(`Email error: ${e.message}`, "error"); }
  };

  const resetData = () => { if (confirm("Reset all data?")) { const d = defaultData; setData(d); fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).catch(() => {}); } };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: theme.bg, fontFamily: "'DM Sans', sans-serif", color: theme.text }}>
      <style>{`@keyframes modalIn{from{opacity:0;transform:translateY(10px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}} @keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:${theme.border};border-radius:3px} input:focus,select:focus,textarea:focus{border-color:${theme.accent}!important;box-shadow:0 0 0 2px ${theme.accentLight}} button:hover{opacity:0.9} table{border-collapse:collapse} .spin{animation:spin 1s linear infinite} .r-tbl{overflow-x:auto;-webkit-overflow-scrolling:touch} @media(max-width:767px){.r-g{grid-template-columns:1fr!important}}`}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Sidebar — desktop only */}
      {!isMobile && <nav style={{ width: 220, background: theme.surface, borderRight: `1px solid ${theme.borderLight}`, display: "flex", flexDirection: "column", padding: "20px 12px", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: theme.accent, padding: "4px 12px 20px", letterSpacing: "-0.02em" }}>Badjr-Pay</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {navItems.map(n => <button key={n.id} onClick={() => { setPage(n.id); setViewInvoice(null); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "none", borderRadius: theme.radiusSm, cursor: "pointer", background: page === n.id ? theme.accentLight : "transparent", color: page === n.id ? theme.accent : theme.textSecondary, fontWeight: page === n.id ? 600 : 400, fontSize: 13, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", textAlign: "left" }}>{n.icon}{n.label}</button>)}
        </div>
        <div style={{ borderTop: `1px solid ${theme.borderLight}`, paddingTop: 12, marginTop: 8 }}>
          {session?.user && <div style={{ padding: "6px 12px", marginBottom: 4 }}><div style={{ fontSize: 12, fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user.name}</div><div style={{ fontSize: 11, color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user.email}</div></div>}
          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ fontSize: 12, color: theme.danger, background: "none", border: "none", cursor: "pointer", padding: "6px 12px", textAlign: "left", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>Sign Out</button>
          <button onClick={resetData} style={{ fontSize: 11, color: theme.textMuted, background: "none", border: "none", cursor: "pointer", padding: "4px 12px", textAlign: "left", fontFamily: "'DM Sans', sans-serif" }}>Reset Data</button>
        </div>
      </nav>}

      {/* Content */}
      <main style={{ flex: 1, padding: isMobile ? "16px 14px" : "24px 28px", paddingBottom: isMobile ? 80 : undefined, maxWidth: isMobile ? "100%" : 960, width: "100%", overflowY: "auto" }}>
        {page === "dashboard" && <DashboardView {...{ data, totalRevenue, outstanding, overdueCount, draftCount, setPage, setModal, updateInvoiceStatus, handleDownloadPDF, handleSendEmail }} />}
        {page === "invoices" && !viewInvoice && <InvoicesView {...{ data, setModal, setEditItem, setViewInvoice, deleteInvoice, updateInvoiceStatus, handleDownloadPDF, handleSendEmail, handleSendOverdue }} />}
        {page === "invoices" && viewInvoice && <InvoiceDetailView invoice={data.invoices.find(i => i.id === viewInvoice.id) || viewInvoice} data={data} onBack={() => setViewInvoice(null)} updateStatus={updateInvoiceStatus} markPartial={markPartialPayment} markInstallmentPaid={markInstallmentPaid} handleDownloadPDF={handleDownloadPDF} handleSendEmail={handleSendEmail} handleSendOverdue={handleSendOverdue} />}
        {page === "clients" && <ClientsView {...{ data, setModal, setEditItem, deleteClient }} />}
        {page === "projects" && <ProjectsView {...{ data, setModal, setEditItem, deleteProject, saveProject }} />}
        {page === "services" && <ServicesView {...{ data, setModal, setEditItem, deleteService }} />}
        {page === "categories" && <CategoriesView {...{ data, setModal, setEditItem, deleteCategory }} />}
        {page === "reports" && <ReportsView data={data} />}
        {page === "users" && <UsersView />}
        {page === "settings" && <SettingsView settings={data.settings} onSave={saveSettings} />}
      </main>

      {/* Modals */}
      <Modal open={modal === "client"} onClose={() => { setModal(null); setEditItem(null); }} title={editItem ? "Edit Client" : "New Client"}><ClientForm item={editItem} onSave={saveClient} onCancel={() => { setModal(null); setEditItem(null); }} /></Modal>
      <Modal open={modal === "category"} onClose={() => { setModal(null); setEditItem(null); }} title={editItem ? "Edit Category" : "New Category"}><CategoryForm item={editItem} onSave={saveCategory} onCancel={() => { setModal(null); setEditItem(null); }} /></Modal>
      <Modal open={modal === "service"} onClose={() => { setModal(null); setEditItem(null); }} title={editItem ? "Edit Service" : "New Service"}><ServiceForm item={editItem} categories={data.categories} onSave={saveService} onCancel={() => { setModal(null); setEditItem(null); }} /></Modal>
      <Modal open={modal === "project"} onClose={() => { setModal(null); setEditItem(null); }} title={editItem ? "Edit Project" : "New Project"}><ProjectForm item={editItem} onSave={saveProject} onCancel={() => { setModal(null); setEditItem(null); }} /></Modal>
      <Modal open={modal === "invoice"} onClose={() => { setModal(null); setEditItem(null); }} title={editItem ? "Edit Invoice" : "New Invoice"} width={640}><InvoiceForm item={editItem} data={data} onSave={saveInvoice} onCancel={() => { setModal(null); setEditItem(null); }} /></Modal>

      {/* Bottom nav — mobile only */}
      {isMobile && <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, background: theme.surface, borderTop: `1px solid ${theme.borderLight}`, display: "flex", overflowX: "auto", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {navItems.map(n => <button key={n.id} onClick={() => { setPage(n.id); setViewInvoice(null); }} style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 12px", border: "none", background: "transparent", color: page === n.id ? theme.accent : theme.textMuted, fontSize: 9, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", minWidth: 56, fontWeight: page === n.id ? 600 : 400 }}>
          <span style={{ color: page === n.id ? theme.accent : theme.textMuted }}>{n.icon}</span>
          {n.label}
        </button>)}
      </nav>}
    </div>
  );
}

// ═══════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════
function DashboardView({ data, totalRevenue, outstanding, overdueCount, draftCount, setPage, setModal, updateInvoiceStatus, handleDownloadPDF, handleSendEmail }) {
  const recent = [...data.invoices].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5);
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
      <h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Dashboard</h1>
      <Btn icon={Icons.plus} onClick={() => setModal("invoice")}>New Invoice</Btn>
    </div>
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
      <StatCard label="Revenue" value={fmt(totalRevenue)} icon={Icons.dollar} color={theme.success} />
      <StatCard label="Outstanding" value={fmt(outstanding)} icon={Icons.clock} color={theme.warning} />
      <StatCard label="Overdue" value={overdueCount} icon={Icons.invoice} color={theme.danger} />
      <StatCard label="Drafts" value={draftCount} icon={Icons.edit} color={theme.textMuted} />
    </div>
    <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${theme.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: 14, fontFamily: "'Fraunces', serif" }}>Recent Invoices</span>
        <button onClick={() => setPage("invoices")} style={{ fontSize: 12, color: theme.accent, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>View All →</button>
      </div>
      {recent.length === 0 ? <Empty icon={Icons.invoice} message="No invoices yet" action={<Btn size="sm" onClick={() => setModal("invoice")} icon={Icons.plus}>Create Invoice</Btn>} /> :
        <table style={{ width: "100%", fontSize: 13 }}><thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
          {["Invoice", "Client", "Amount", "Status", "Actions"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.textMuted, fontWeight: 600 }}>{h}</th>)}
        </tr></thead><tbody>
          {recent.map(inv => <tr key={inv.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
            <td style={{ padding: "10px 14px", fontWeight: 500 }}>{inv.number}</td>
            <td style={{ padding: "10px 14px", color: theme.textSecondary }}>{inv.clientName || "-"}</td>
            <td style={{ padding: "10px 14px", fontWeight: 600, fontFamily: "'Fraunces', serif" }}>{fmt(inv.total || 0)}</td>
            <td style={{ padding: "10px 14px" }}><StatusBadge status={inv.status} /></td>
            <td style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", gap: 4 }}>
                <Btn size="sm" variant="secondary" icon={Icons.download} onClick={() => handleDownloadPDF(inv)} title="Download PDF" />
                <Btn size="sm" variant="blue" icon={Icons.mail} onClick={() => handleSendEmail(inv)} title="Email Invoice" />
                {inv.status === "draft" && <Btn size="sm" variant="secondary" icon={Icons.send} onClick={() => updateInvoiceStatus(inv.id, "sent")}>Send</Btn>}
                {["sent", "viewed"].includes(inv.status) && <Btn size="sm" variant="success" icon={Icons.check} onClick={() => updateInvoiceStatus(inv.id, "paid")}>Paid</Btn>}
              </div>
            </td>
          </tr>)}
        </tbody></table>}
    </div>
  </div>;
}

function InvoicesView({ data, setModal, setEditItem, setViewInvoice, deleteInvoice, updateInvoiceStatus, handleDownloadPDF, handleSendEmail, handleSendOverdue }) {
  const [filter, setFilter] = useState("all");
  const filtered = data.invoices.filter(i => filter === "all" || i.status === filter).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const tabs = [{ id: "all", label: "All" }, { id: "draft", label: "Draft" }, { id: "sent", label: "Sent" }, { id: "paid", label: "Paid" }, { id: "overdue", label: "Overdue" }];
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Invoices</h1>
      <Btn icon={Icons.plus} onClick={() => setModal("invoice")}>New Invoice</Btn>
    </div>
    <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
      {tabs.map(t => <button key={t.id} onClick={() => setFilter(t.id)} style={{ padding: "6px 14px", border: "none", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", background: filter === t.id ? theme.accent : theme.surfaceAlt, color: filter === t.id ? "#fff" : theme.textSecondary }}>{t.label}</button>)}
    </div>
    <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, overflow: "hidden" }}>
      {filtered.length === 0 ? <Empty icon={Icons.invoice} message="No invoices found" action={<Btn size="sm" onClick={() => setModal("invoice")} icon={Icons.plus}>Create Invoice</Btn>} /> :
        <table style={{ width: "100%", fontSize: 13 }}><thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
          {["Invoice", "Client", "Date", "Amount", "Status", "Actions"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.textMuted, fontWeight: 600 }}>{h}</th>)}
        </tr></thead><tbody>
          {filtered.map(inv => <tr key={inv.id} style={{ borderBottom: `1px solid ${theme.borderLight}`, cursor: "pointer" }} onClick={() => setViewInvoice(inv)}>
            <td style={{ padding: "10px 14px", fontWeight: 500 }}>{inv.number}</td>
            <td style={{ padding: "10px 14px", color: theme.textSecondary }}>{inv.clientName || "-"}</td>
            <td style={{ padding: "10px 14px", color: theme.textMuted, fontSize: 12 }}>{inv.createdAt ? fmtDate(inv.createdAt) : "-"}</td>
            <td style={{ padding: "10px 14px", fontWeight: 600, fontFamily: "'Fraunces', serif" }}>{fmt(inv.total || 0)}</td>
            <td style={{ padding: "10px 14px" }}><StatusBadge status={inv.status} /></td>
            <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", gap: 3 }}>
                <Btn size="sm" variant="secondary" icon={Icons.download} onClick={() => handleDownloadPDF(inv)} title="PDF" />
                <Btn size="sm" variant="blue" icon={Icons.mail} onClick={() => handleSendEmail(inv)} title="Email" />
                {inv.status === "draft" && <Btn size="sm" variant="secondary" icon={Icons.send} onClick={() => updateInvoiceStatus(inv.id, "sent")} />}
                {["sent", "viewed", "partial"].includes(inv.status) && <Btn size="sm" variant="success" icon={Icons.check} onClick={() => updateInvoiceStatus(inv.id, "paid")} />}
                {inv.status === "overdue" && <Btn size="sm" variant="danger" icon={Icons.mail} onClick={() => handleSendOverdue(inv)} title="Send overdue reminder" />}
                <Btn size="sm" variant="ghost" icon={Icons.edit} onClick={() => { setEditItem(inv); setModal("invoice"); }} />
                <Btn size="sm" variant="ghost" icon={Icons.trash} onClick={() => { if (confirm("Delete?")) deleteInvoice(inv.id); }} style={{ color: theme.danger }} />
              </div>
            </td>
          </tr>)}
        </tbody></table>}
    </div>
  </div>;
}

function InvoiceDetailView({ invoice: inv, data, onBack, updateStatus, markPartial, markInstallmentPaid, handleDownloadPDF, handleSendEmail, handleSendOverdue }) {
  const [payAmount, setPayAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const remaining = (inv.total || 0) - (inv.amountPaid || 0);
  const project = data.projects.find(p => p.id === inv.projectId);
  const onSend = async () => { setSending(true); await handleSendEmail(inv); setSending(false); };
  const onSendReminder = async () => { setSendingReminder(true); await handleSendOverdue(inv); setSendingReminder(false); };
  const onDownloadPDF = async () => { setDownloadingPDF(true); await handleDownloadPDF(inv); setDownloadingPDF(false); };

  return <div>
    <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: theme.textSecondary, fontSize: 13, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>{Icons.back} Back to Invoices</button>

    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <Btn variant="secondary" icon={downloadingPDF ? <span className="spin" style={{ display: "inline-flex" }}>{Icons.spinner}</span> : Icons.download} onClick={onDownloadPDF} disabled={downloadingPDF}>{downloadingPDF ? "Generating..." : "Download PDF"}</Btn>
      <Btn variant="blue" icon={sending ? <span className="spin" style={{ display: "inline-flex" }}>{Icons.spinner}</span> : Icons.mail} onClick={onSend} disabled={sending}>{sending ? "Sending..." : "Email to Client"}</Btn>
      {inv.status === "overdue" && <Btn variant="danger" icon={sendingReminder ? <span className="spin" style={{ display: "inline-flex" }}>{Icons.spinner}</span> : Icons.mail} onClick={onSendReminder} disabled={sendingReminder}>{sendingReminder ? "Sending..." : "Send Overdue Reminder"}</Btn>}
      {inv.status === "draft" && <Btn icon={Icons.send} onClick={() => updateStatus(inv.id, "sent")}>Mark as Sent</Btn>}
      {inv.status !== "paid" && <Btn variant="success" icon={Icons.check} onClick={() => updateStatus(inv.id, "paid")}>Mark Fully Paid</Btn>}
    </div>

    <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, padding: "28px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 700, color: theme.accent, marginBottom: 4 }}>INVOICE</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{inv.number}</div>
          {data.settings.companyName && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{data.settings.companyName}</div>}
        </div>
        <StatusBadge status={inv.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.textMuted, marginBottom: 6, fontWeight: 600 }}>Bill To</div>
          <div style={{ fontWeight: 600 }}>{inv.clientName || "-"}</div>
          {inv.clientEmail && <div style={{ fontSize: 13, color: theme.textSecondary }}>{inv.clientEmail}</div>}
          {inv.clientPhone && <div style={{ fontSize: 13, color: theme.textSecondary }}>{inv.clientPhone}</div>}
          {inv.clientAddress && <div style={{ fontSize: 13, color: theme.textSecondary, whiteSpace: "pre-line" }}>{inv.clientAddress}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, color: theme.textSecondary }}>Issued: {inv.createdAt ? fmtDate(inv.createdAt) : "-"}</div>
          <div style={{ fontSize: 13, color: theme.textSecondary }}>Due: {inv.dueDate ? fmtDate(inv.dueDate) : "-"}</div>
          {project && <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>Project: {project.name}</div>}
          {inv.sentAt && <div style={{ fontSize: 12, color: theme.blue, marginTop: 4 }}>Sent: {fmtDate(inv.sentAt)}</div>}
          {inv.paidAt && <div style={{ fontSize: 12, color: theme.success, marginTop: 2 }}>Paid: {fmtDate(inv.paidAt)}</div>}
        </div>
      </div>

      <table style={{ width: "100%", fontSize: 13, marginBottom: 24 }}>
        <thead><tr style={{ borderBottom: `2px solid ${theme.border}` }}>
          {["Item", "Qty", "Rate", "Total"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: h === "Item" ? "left" : "right", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.textMuted, fontWeight: 600 }}>{h}</th>)}
        </tr></thead>
        <tbody>{(inv.items || []).map((li, i) => <tr key={i} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
          <td style={{ padding: "10px 12px" }}>{li.description}</td>
          <td style={{ padding: "10px 12px", textAlign: "right" }}>{li.qty}</td>
          <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmt(li.rate)}</td>
          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{fmt(li.qty * li.rate)}</td>
        </tr>)}</tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <div style={{ width: 240 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: theme.textSecondary }}><span>Subtotal</span><span>{fmt(inv.total || 0)}</span></div>
          {(inv.amountPaid || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: theme.success }}><span>Paid</span><span>-{fmt(inv.amountPaid)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `2px solid ${theme.text}`, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}><span>Total Due</span><span>{fmt(remaining)}</span></div>
        </div>
      </div>

      {inv.notes && <div style={{ padding: "14px 16px", background: theme.surfaceAlt, borderRadius: theme.radiusSm, fontSize: 13, color: theme.textSecondary, marginBottom: 20 }}><span style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Notes</span>{inv.notes}</div>}

      {(inv.installments || []).length > 0 ? (
        <div style={{ paddingTop: 16, borderTop: `1px solid ${theme.borderLight}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.textMuted, marginBottom: 12 }}>Payment Schedule</div>
          <div style={{ display: "grid", gap: 8 }}>
            {(inv.installments || []).map((inst, i) => (
              <div key={inst.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: inst.status === "paid" ? `${theme.success}12` : theme.surfaceAlt, borderRadius: theme.radiusSm, border: `1px solid ${inst.status === "paid" ? theme.success + "40" : theme.borderLight}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: inst.status === "paid" ? theme.success : theme.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {inst.status === "paid" ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted }}>{i + 1}</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Payment {i + 1} — {fmt(inst.amount)}</div>
                    <div style={{ fontSize: 11, color: theme.textSecondary }}>Due {fmtDate(inst.dueDate)}{inst.paidAt ? ` · Paid ${fmtDate(inst.paidAt)}` : ""}</div>
                  </div>
                </div>
                {inst.status !== "paid" && inv.status !== "paid" && (
                  <Btn size="sm" variant="success" onClick={() => markInstallmentPaid(inv.id, inst.id)}>Mark Paid</Btn>
                )}
                {inst.status === "paid" && <span style={{ fontSize: 11, fontWeight: 600, color: theme.success }}>PAID</span>}
              </div>
            ))}
          </div>
        </div>
      ) : inv.status !== "paid" ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 16, borderTop: `1px solid ${theme.borderLight}`, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500 }}>Record partial payment:</span>
          <input type="number" placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} style={{ width: 110, padding: "7px 10px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }} />
          <Btn variant="secondary" size="sm" onClick={() => { const amt = parseFloat(payAmount); if (amt > 0) { markPartial(inv.id, amt); setPayAmount(""); } }}>Record Payment</Btn>
        </div>
      ) : null}
    </div>
  </div>;
}

function ProjectsView({ data, setModal, setEditItem, deleteProject, saveProject }) {
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Projects</h1><Btn icon={Icons.plus} onClick={() => setModal("project")}>New Project</Btn></div>
    {data.projects.length === 0 ? <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}` }}><Empty icon={Icons.project} message="No projects yet" action={<Btn size="sm" onClick={() => setModal("project")} icon={Icons.plus}>Create Project</Btn>} /></div> :
      <div style={{ display: "grid", gap: 12 }}>{data.projects.map(p => {
        const ic = data.invoices.filter(i => i.projectId === p.id).length; const pr = data.invoices.filter(i => i.projectId === p.id && i.status === "paid").reduce((s, i) => s + (i.total || 0), 0);
        return <div key={p.id} style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{p.name}</div>{p.clientName && <div style={{ fontSize: 12, color: theme.textSecondary }}>{p.clientName}</div>}{p.description && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{p.description}</div>}</div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><StatusBadge status={p.status} /><select value={p.status} onChange={e => saveProject({ ...p, status: e.target.value })} style={{ fontSize: 11, border: `1px solid ${theme.border}`, borderRadius: 4, padding: "2px 4px", background: theme.surface, cursor: "pointer" }}><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select><Btn size="sm" variant="ghost" icon={Icons.edit} onClick={() => { setEditItem(p); setModal("project"); }} /><Btn size="sm" variant="ghost" icon={Icons.trash} onClick={() => { if (confirm("Delete?")) deleteProject(p.id); }} style={{ color: theme.danger }} /></div></div>
          <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: 12, color: theme.textSecondary }}><span>{ic} invoice{ic !== 1 ? "s" : ""}</span><span>Revenue: {fmt(pr)}</span>{p.createdAt && <span>Created {fmtDate(p.createdAt)}</span>}</div>
        </div>;
      })}</div>}
  </div>;
}

function ServicesView({ data, setModal, setEditItem, deleteService }) {
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Services</h1><Btn icon={Icons.plus} onClick={() => setModal("service")}>New Service</Btn></div>
    {data.services.length === 0 ? <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}` }}><Empty icon={Icons.service} message="No services yet" action={<Btn size="sm" onClick={() => setModal("service")} icon={Icons.plus}>Create Service</Btn>} /></div> :
      <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, overflow: "hidden" }}><table style={{ width: "100%", fontSize: 13 }}><thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}>{["Service", "Category", "Rate", "Unit", ""].map(h => <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.textMuted, fontWeight: 600 }}>{h}</th>)}</tr></thead><tbody>
        {data.services.map(s => { const cat = data.categories.find(c => c.id === s.categoryId); return <tr key={s.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}><td style={{ padding: "10px 16px" }}><div style={{ fontWeight: 500 }}>{s.name}</div>{s.description && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{s.description}</div>}</td><td style={{ padding: "10px 16px" }}>{cat && <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: cat.color + "18", color: cat.color }}>{cat.name}</span>}</td><td style={{ padding: "10px 16px", fontWeight: 600, fontFamily: "'Fraunces', serif" }}>{fmt(s.rate || 0)}</td><td style={{ padding: "10px 16px", color: theme.textSecondary, fontSize: 12 }}>{s.unit || "per unit"}</td><td style={{ padding: "10px 16px" }}><div style={{ display: "flex", gap: 4 }}><Btn size="sm" variant="ghost" icon={Icons.edit} onClick={() => { setEditItem(s); setModal("service"); }} /><Btn size="sm" variant="ghost" icon={Icons.trash} onClick={() => { if (confirm("Delete?")) deleteService(s.id); }} style={{ color: theme.danger }} /></div></td></tr>; })}
      </tbody></table></div>}
  </div>;
}

function CategoriesView({ data, setModal, setEditItem, deleteCategory }) {
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Service Categories</h1><Btn icon={Icons.plus} onClick={() => setModal("category")}>New Category</Btn></div>
    <div style={{ display: "grid", gap: 10 }}>{data.categories.map(cat => { const sc = data.services.filter(s => s.categoryId === cat.id).length; return <div key={cat.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "14px 18px", border: `1px solid ${theme.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: cat.color }} /><span style={{ fontWeight: 500, fontSize: 14 }}>{cat.name}</span><span style={{ fontSize: 12, color: theme.textMuted }}>{sc} service{sc !== 1 ? "s" : ""}</span></div><div style={{ display: "flex", gap: 4 }}><Btn size="sm" variant="ghost" icon={Icons.edit} onClick={() => { setEditItem(cat); setModal("category"); }} /><Btn size="sm" variant="ghost" icon={Icons.trash} onClick={() => { if (confirm("Delete?")) deleteCategory(cat.id); }} style={{ color: theme.danger }} /></div></div>; })}</div>
  </div>;
}


// ═══════════════════════════════════════
// REPORTS VIEW
// ═══════════════════════════════════════
function ReportsView({ data }) {
  const [tab, setTab] = useState("income");
  const [period, setPeriod] = useState("monthly");
  const [year, setYear] = useState(new Date().getFullYear());

  const paidInvoices = data.invoices.filter(i => i.status === "paid");
  const allInvoices = data.invoices;

  // ─── Income by period ───
  const getMonthKey = (d) => { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; };
  const getQuarterKey = (d) => { const dt = new Date(d); return `${dt.getFullYear()}-Q${Math.ceil((dt.getMonth() + 1) / 3)}`; };
  const getYearKey = (d) => String(new Date(d).getFullYear());

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const buildPeriodData = () => {
    const keyFn = period === "monthly" ? getMonthKey : period === "quarterly" ? getQuarterKey : getYearKey;
    const buckets = {};
    paidInvoices.forEach(inv => {
      const k = keyFn(inv.paidAt || inv.createdAt);
      if (!buckets[k]) buckets[k] = { key: k, revenue: 0, count: 0 };
      buckets[k].revenue += inv.total || 0;
      buckets[k].count++;
    });

    if (period === "monthly") {
      const result = [];
      for (let m = 0; m < 12; m++) {
        const k = `${year}-${String(m + 1).padStart(2, "0")}`;
        result.push({ key: k, label: monthNames[m], revenue: buckets[k]?.revenue || 0, count: buckets[k]?.count || 0 });
      }
      return result;
    } else if (period === "quarterly") {
      return [1, 2, 3, 4].map(q => {
        const k = `${year}-Q${q}`;
        return { key: k, label: `Q${q}`, revenue: buckets[k]?.revenue || 0, count: buckets[k]?.count || 0 };
      });
    } else {
      const years = [...new Set(paidInvoices.map(i => getYearKey(i.paidAt || i.createdAt)))].sort();
      if (years.length === 0) years.push(String(year));
      return years.map(y => ({ key: y, label: y, revenue: buckets[y]?.revenue || 0, count: buckets[y]?.count || 0 }));
    }
  };

  const periodData = buildPeriodData();
  const maxRevenue = Math.max(...periodData.map(d => d.revenue), 1);
  const totalPeriodRevenue = periodData.reduce((s, d) => s + d.revenue, 0);
  const totalPeriodCount = periodData.reduce((s, d) => s + d.count, 0);

  // ─── By client ───
  const clientData = () => {
    const buckets = {};
    paidInvoices.forEach(inv => {
      const k = inv.clientName || "Unknown";
      const name = inv.clientName || "Unknown";
      if (!buckets[k]) buckets[k] = { name, revenue: 0, count: 0, outstanding: 0 };
      buckets[k].revenue += inv.total || 0;
      buckets[k].count++;
    });
    allInvoices.filter(i => ["sent", "viewed", "partial"].includes(i.status)).forEach(inv => {
      const k = inv.clientName || "Unknown";
      const name = inv.clientName || "Unknown";
      if (!buckets[k]) buckets[k] = { name, revenue: 0, count: 0, outstanding: 0 };
      buckets[k].outstanding += (inv.total || 0) - (inv.amountPaid || 0);
    });
    return Object.values(buckets).sort((a, b) => b.revenue - a.revenue);
  };

  // ─── By project ───
  const projectData = () => {
    const buckets = {};
    paidInvoices.forEach(inv => {
      const k = inv.projectId || "_none";
      const proj = data.projects.find(p => p.id === inv.projectId);
      const name = proj?.name || "No Project";
      if (!buckets[k]) buckets[k] = { name, revenue: 0, count: 0 };
      buckets[k].revenue += inv.total || 0;
      buckets[k].count++;
    });
    return Object.values(buckets).sort((a, b) => b.revenue - a.revenue);
  };

  // ─── CSV Export ───
  const exportCSV = (type) => {
    let csv = "";
    if (type === "income") {
      csv = "Period,Revenue,Invoices Paid\n";
      periodData.forEach(d => { csv += `${d.label},${d.revenue.toFixed(2)},${d.count}\n`; });
    } else if (type === "clients") {
      csv = "Client,Revenue,Invoices Paid,Outstanding\n";
      clientData().forEach(d => { csv += `"${d.name}",${d.revenue.toFixed(2)},${d.count},${d.outstanding.toFixed(2)}\n`; });
    } else if (type === "projects") {
      csv = "Project,Revenue,Invoices Paid\n";
      projectData().forEach(d => { csv += `"${d.name}",${d.revenue.toFixed(2)},${d.count}\n`; });
    } else if (type === "all_invoices") {
      csv = "Invoice,Client,Date,Due Date,Status,Total,Amount Paid,Balance\n";
      allInvoices.forEach(inv => {
        csv += `${inv.number},"${inv.clientName || ""}",${inv.createdAt || ""},${inv.dueDate || ""},${inv.status},${(inv.total || 0).toFixed(2)},${(inv.amountPaid || 0).toFixed(2)},${((inv.total || 0) - (inv.amountPaid || 0)).toFixed(2)}\n`;
      });
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `badjr-pay-${type}-report.csv`;
    a.click();
  };

  const tabs = [
    { id: "income", label: "Income Report" },
    { id: "clients", label: "By Client" },
    { id: "projects", label: "By Project" },
  ];

  const availableYears = [...new Set(allInvoices.map(i => new Date(i.createdAt || Date.now()).getFullYear()))];
  if (!availableYears.includes(year)) availableYears.push(year);
  availableYears.sort((a, b) => b - a);

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Reports</h1>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn size="sm" variant="secondary" icon={Icons.download} onClick={() => exportCSV(tab)}>Export CSV</Btn>
        <Btn size="sm" variant="secondary" icon={Icons.download} onClick={() => exportCSV("all_invoices")}>Export All Invoices</Btn>
      </div>
    </div>

    <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
      {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "6px 14px", border: "none", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", background: tab === t.id ? theme.accent : theme.surfaceAlt, color: tab === t.id ? "#fff" : theme.textSecondary }}>{t.label}</button>)}
    </div>

    {/* ─── Income Report ─── */}
    {tab === "income" && <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["monthly", "quarterly", "annual"].map(p => <button key={p} onClick={() => setPeriod(p)} style={{ padding: "5px 12px", border: `1px solid ${period === p ? theme.accent : theme.border}`, borderRadius: theme.radiusSm, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", background: period === p ? theme.accentLight : theme.surface, color: period === p ? theme.accent : theme.textSecondary, fontWeight: period === p ? 600 : 400 }}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>)}
        </div>
        {period !== "annual" && <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: "5px 10px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 12, fontFamily: "'DM Sans', sans-serif", background: theme.surface, cursor: "pointer" }}>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>}
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label={`${period === "annual" ? "All-Time" : year} Revenue`} value={fmt(totalPeriodRevenue)} icon={Icons.dollar} color={theme.success} />
        <StatCard label="Invoices Paid" value={totalPeriodCount} icon={Icons.check} color={theme.accent} />
        <StatCard label="Avg per Invoice" value={fmt(totalPeriodCount > 0 ? totalPeriodRevenue / totalPeriodCount : 0)} icon={Icons.invoice} color={theme.blue} />
      </div>

      {/* Bar chart */}
      <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Fraunces', serif", marginBottom: 16 }}>Revenue {period === "annual" ? "by Year" : `— ${year}`}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: period === "quarterly" ? 16 : 6, height: 180 }}>
          {periodData.map((d, i) => {
            const h = maxRevenue > 0 ? (d.revenue / maxRevenue) * 150 : 0;
            return <div key={d.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 500, whiteSpace: "nowrap" }}>{d.revenue > 0 ? fmt(d.revenue) : ""}</div>
              <div style={{ width: "100%", maxWidth: 40, height: Math.max(h, 2), background: d.revenue > 0 ? theme.accent : theme.borderLight, borderRadius: "4px 4px 0 0", transition: "height 0.3s ease" }} />
              <div style={{ fontSize: 11, color: theme.textSecondary, fontWeight: 500 }}>{d.label}</div>
            </div>;
          })}
        </div>
      </div>

      {/* Period table */}
      <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 13 }}>
          <thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
            {["Period", "Revenue", "Invoices", "Avg Invoice"].map(h => <th key={h} style={{ padding: "10px 16px", textAlign: h === "Period" ? "left" : "right", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.textMuted, fontWeight: 600 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {periodData.map(d => <tr key={d.key} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
              <td style={{ padding: "10px 16px", fontWeight: 500 }}>{d.label}</td>
              <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, fontFamily: "'Fraunces', serif" }}>{fmt(d.revenue)}</td>
              <td style={{ padding: "10px 16px", textAlign: "right", color: theme.textSecondary }}>{d.count}</td>
              <td style={{ padding: "10px 16px", textAlign: "right", color: theme.textSecondary }}>{d.count > 0 ? fmt(d.revenue / d.count) : "—"}</td>
            </tr>)}
            <tr style={{ background: theme.surfaceAlt }}>
              <td style={{ padding: "10px 16px", fontWeight: 700 }}>Total</td>
              <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, fontFamily: "'Fraunces', serif" }}>{fmt(totalPeriodRevenue)}</td>
              <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600 }}>{totalPeriodCount}</td>
              <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600 }}>{totalPeriodCount > 0 ? fmt(totalPeriodRevenue / totalPeriodCount) : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>}

    {/* ─── By Client ─── */}
    {tab === "clients" && <div>
      {(() => {
        const cd = clientData();
        const maxRev = Math.max(...cd.map(c => c.revenue), 1);
        const totalRev = cd.reduce((s, c) => s + c.revenue, 0);
        return <>
          <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, padding: "20px 24px", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Fraunces', serif", marginBottom: 16 }}>Revenue by Client</div>
            {cd.length === 0 ? <div style={{ color: theme.textMuted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No paid invoices yet</div> :
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cd.map((c, i) => <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>{fmt(c.revenue)}</span>
                  </div>
                  <div style={{ height: 8, background: theme.borderLight, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(c.revenue / maxRev) * 100}%`, background: theme.accent, borderRadius: 4, transition: "width 0.3s ease" }} />
                  </div>
                </div>)}
              </div>}
          </div>
          <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                {["Client", "Revenue", "% of Total", "Paid Invoices", "Outstanding"].map(h => <th key={h} style={{ padding: "10px 16px", textAlign: h === "Client" ? "left" : "right", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.textMuted, fontWeight: 600 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {cd.map((c, i) => <tr key={i} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                  <td style={{ padding: "10px 16px", fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, fontFamily: "'Fraunces', serif" }}>{fmt(c.revenue)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: theme.textSecondary }}>{totalRev > 0 ? `${((c.revenue / totalRev) * 100).toFixed(1)}%` : "—"}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: theme.textSecondary }}>{c.count}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: c.outstanding > 0 ? theme.warning : theme.textMuted, fontWeight: c.outstanding > 0 ? 600 : 400 }}>{c.outstanding > 0 ? fmt(c.outstanding) : "—"}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </>;
      })()}
    </div>}

    {/* ─── By Project ─── */}
    {tab === "projects" && <div>
      {(() => {
        const pd = projectData();
        const maxRev = Math.max(...pd.map(p => p.revenue), 1);
        return <>
          <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, padding: "20px 24px", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Fraunces', serif", marginBottom: 16 }}>Revenue by Project</div>
            {pd.length === 0 ? <div style={{ color: theme.textMuted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No paid invoices yet</div> :
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pd.map((p, i) => <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>{fmt(p.revenue)}</span>
                  </div>
                  <div style={{ height: 8, background: theme.borderLight, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(p.revenue / maxRev) * 100}%`, background: theme.blue, borderRadius: 4, transition: "width 0.3s ease" }} />
                  </div>
                </div>)}
              </div>}
          </div>
          <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                {["Project", "Revenue", "Invoices Paid"].map(h => <th key={h} style={{ padding: "10px 16px", textAlign: h === "Project" ? "left" : "right", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.textMuted, fontWeight: 600 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {pd.map((p, i) => <tr key={i} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                  <td style={{ padding: "10px 16px", fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, fontFamily: "'Fraunces', serif" }}>{fmt(p.revenue)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: theme.textSecondary }}>{p.count}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </>;
      })()}
    </div>}
  </div>;
}

// ═══════════════════════════════════════
// SETTINGS VIEW
// ═══════════════════════════════════════
function UsersView() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(setUsers).catch(() => {});
  }, []);

  const addUser = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    setLoading(false);
    if (res.ok) { setUsers(u => [...u, data]); setForm({ name: "", email: "", password: "" }); setAdding(false); }
    else setError(data.error || "Failed to add user");
  };

  const removeUser = async (id) => {
    if (!confirm("Remove this user?")) return;
    await fetch("/api/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setUsers(u => u.filter(x => x.id !== id));
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Admin Users</h1>
      <Btn icon={Icons.plus} onClick={() => { setAdding(true); setError(""); }}>Add User</Btn>
    </div>

    {adding && <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, padding: "20px 24px", marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 14px", fontFamily: "'Fraunces', serif", fontSize: 16 }}>New Admin User</h3>
      {error && <div style={{ background: theme.dangerLight, color: theme.danger, padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <form onSubmit={addUser} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="r-g" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Full Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@badjrtech.com" />
        </div>
        <Input label="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="At least 8 characters" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={() => setAdding(false)}>Cancel</Btn>
          <Btn disabled={loading}>{loading ? "Adding…" : "Add User"}</Btn>
        </div>
      </form>
    </div>}

    <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, overflow: "hidden" }}>
      {users.length === 0 ? <Empty icon={Icons.user} message="No users yet" /> :
        users.map((u, i) => <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: i < users.length - 1 ? `1px solid ${theme.borderLight}` : "none" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
            <div style={{ fontSize: 12, color: theme.textSecondary }}>{u.email}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: theme.accentLight, color: theme.accent, fontWeight: 600 }}>{u.role}</span>
            {users.length > 1 && <Btn size="sm" variant="ghost" icon={Icons.trash} onClick={() => removeUser(u.id)} style={{ color: theme.danger }} />}
          </div>
        </div>)}
    </div>
  </div>;
}

function SettingsView({ settings, onSave }) {
  const [form, setForm] = useState({ ...settings });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return <div>
    <h1 style={{ margin: "0 0 20px", fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Settings</h1>

    <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, padding: "20px 24px", marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 4px", fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600 }}>Company Information</h3>
      <p style={{ fontSize: 12, color: theme.textMuted, margin: "0 0 14px" }}>Appears on your PDF invoices and emails.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Company Name" value={form.companyName || ""} onChange={e => set("companyName", e.target.value)} placeholder="BaDjR Tech" />
        <Input label="Phone" value={form.companyPhone || ""} onChange={e => set("companyPhone", e.target.value)} placeholder="(555) 123-4567" />
      </div>
      <div style={{ marginTop: 12 }}><Input label="Address" value={form.companyAddress || ""} onChange={e => set("companyAddress", e.target.value)} placeholder="123 Main St, Washington, DC" /></div>
    </div>

<div style={{ display: "flex", justifyContent: "flex-end" }}><Btn onClick={() => onSave(form)}>Save Settings</Btn></div>
  </div>;
}

// ═══════════════════════════════════════
// FORMS
// ═══════════════════════════════════════
function CategoryForm({ item, onSave, onCancel }) {
  const [name, setName] = useState(item?.name || ""); const [color, setColor] = useState(item?.color || "#2D5A3D");
  const colors = ["#2D5A3D", "#2B5EA7", "#C4841D", "#B5342B", "#7B3FA0", "#1A7A8A", "#A06B3F", "#5A5A5A"];
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Input label="Category Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Design, Development" />
    <div><label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, display: "block", marginBottom: 6 }}>Color</label><div style={{ display: "flex", gap: 6 }}>{colors.map(c => <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: color === c ? "3px solid #fff" : "2px solid transparent", boxShadow: color === c ? `0 0 0 2px ${c}` : "none", cursor: "pointer" }} />)}</div></div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}><Btn variant="secondary" onClick={onCancel}>Cancel</Btn><Btn onClick={() => name.trim() && onSave({ ...(item || {}), name: name.trim(), color })}>Save</Btn></div>
  </div>;
}

function ServiceForm({ item, categories, onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", description: "", rate: "", unit: "per hour", categoryId: categories[0]?.id || "", ...item });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Input label="Service Name" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. UI/UX Design" />
    <Textarea label="Description" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Brief description..." />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Input label="Rate ($)" type="number" value={form.rate} onChange={e => set("rate", e.target.value)} placeholder="0.00" /><Select label="Unit" value={form.unit} onChange={e => set("unit", e.target.value)}><option value="per hour">Per Hour</option><option value="per project">Per Project</option><option value="per unit">Per Unit</option><option value="flat rate">Flat Rate</option></Select></div>
    <Select label="Category" value={form.categoryId} onChange={e => set("categoryId", e.target.value)}><option value="">No Category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}><Btn variant="secondary" onClick={onCancel}>Cancel</Btn><Btn onClick={() => form.name.trim() && onSave({ ...form, rate: parseFloat(form.rate) || 0 })}>Save</Btn></div>
  </div>;
}

function ProjectForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", description: "", clientName: "", ...item });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Input label="Project Name" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Website Redesign" />
    <Input label="Client Name (optional)" value={form.clientName} onChange={e => set("clientName", e.target.value)} placeholder="Who is this for?" />
    <Textarea label="Description" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Project details..." />
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}><Btn variant="secondary" onClick={onCancel}>Cancel</Btn><Btn onClick={() => form.name.trim() && onSave(form)}>Save</Btn></div>
  </div>;
}


function generateInstallments(total, numPayments, interval, startDate) {
  if (!startDate || !total || numPayments < 2) return [];
  const base = Math.floor((total / numPayments) * 100) / 100;
  const last = Math.round((total - base * (numPayments - 1)) * 100) / 100;
  const result = [];
  let d = new Date(startDate + "T00:00:00");
  for (let i = 0; i < numPayments; i++) {
    result.push({ id: genId(), amount: i === numPayments - 1 ? last : base, dueDate: d.toISOString().split("T")[0], status: "pending", paidAt: null });
    if (interval === "monthly") d = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
    else if (interval === "biweekly") d = new Date(d.getTime() + 14 * 86400000);
    else d = new Date(d.getTime() + 7 * 86400000);
  }
  return result;
}

function InvoiceForm({ item, data, onSave, onCancel }) {
  const hasExistingInstallments = (item?.installments || []).length > 0;
  const [form, setForm] = useState({ clientId: "", clientName: "", clientEmail: "", clientPhone: "", clientAddress: "", projectId: "", dueDate: "", notes: "", items: [{ description: "", qty: 1, rate: 0 }], installments: [], paymentPlan: hasExistingInstallments, planPayments: 3, planInterval: "monthly", planStartDate: "", ...item });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setLI = (i, k, v) => { const items = [...form.items]; items[i] = { ...items[i], [k]: v }; set("items", items); };
  const addLine = () => set("items", [...form.items, { description: "", qty: 1, rate: 0 }]);
  const removeLine = (i) => set("items", form.items.filter((_, idx) => idx !== i));
  const addSvc = (svcId) => { const svc = data.services.find(s => s.id === svcId); if (svc) set("items", [...form.items, { description: svc.name, qty: 1, rate: svc.rate || 0 }]); };
  const total = form.items.reduce((s, li) => s + ((parseFloat(li.qty) || 0) * (parseFloat(li.rate) || 0)), 0);
  const selectedClient = data.clients.find(c => c.id === form.clientId);
  const handleClientSelect = (id) => {
    const cl = data.clients.find(c => c.id === id);
    if (cl) setForm(f => ({ ...f, clientId: cl.id, clientName: cl.name, clientEmail: cl.email, clientPhone: cl.phone, clientAddress: cl.address }));
    else setForm(f => ({ ...f, clientId: "", clientName: "", clientEmail: "", clientPhone: "", clientAddress: "" }));
  };
  const previewInstallments = !hasExistingInstallments && form.paymentPlan && form.planStartDate && total > 0
    ? generateInstallments(total, form.planPayments, form.planInterval, form.planStartDate)
    : [];
  const handleSave = () => {
    if (!form.clientId) return;
    const installments = (!hasExistingInstallments && form.paymentPlan)
      ? generateInstallments(total, form.planPayments, form.planInterval, form.planStartDate)
      : (form.installments || []);
    onSave({ ...form, installments });
  };
  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ background: theme.surfaceAlt, borderRadius: theme.radiusSm, padding: "12px 14px", border: `1px solid ${theme.borderLight}` }}>
      <Select label="Client *" value={form.clientId} onChange={e => handleClientSelect(e.target.value)}>
        <option value="">Select a client…</option>
        {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      {selectedClient && <div style={{ marginTop: 10, fontSize: 13, color: theme.textSecondary, lineHeight: 1.6 }}>
        {selectedClient.email && <div>{selectedClient.email}</div>}
        {selectedClient.phone && <div>{selectedClient.phone}</div>}
        {selectedClient.address && <div style={{ whiteSpace: "pre-line" }}>{selectedClient.address}</div>}
      </div>}
      {data.clients.length === 0 && <div style={{ marginTop: 8, fontSize: 12, color: theme.textMuted }}>No clients yet — add one in the Clients tab first.</div>}
    </div>
    <Input label="Due Date" type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
    <Select label="Project (optional)" value={form.projectId} onChange={e => set("projectId", e.target.value)}><option value="">No Project</option>{data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><label style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Line Items</label>{data.services.length > 0 && <Select style={{ fontSize: 11, padding: "4px 8px" }} onChange={e => { if (e.target.value) { addSvc(e.target.value); e.target.value = ""; } }}><option value="">+ Add Service</option>{data.services.map(s => <option key={s.id} value={s.id}>{s.name} ({fmt(s.rate)})</option>)}</Select>}</div>
      {form.items.map((li, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 60px 100px 30px", gap: 6, marginBottom: 6, alignItems: "end" }}><Input placeholder="Description" value={li.description} onChange={e => setLI(i, "description", e.target.value)} /><Input placeholder="Qty" type="number" value={li.qty} onChange={e => setLI(i, "qty", e.target.value)} /><Input placeholder="Rate" type="number" value={li.rate} onChange={e => setLI(i, "rate", e.target.value)} />{form.items.length > 1 && <button onClick={() => removeLine(i)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.danger, padding: "8px 4px" }}>{Icons.trash}</button>}</div>)}
      <Btn size="sm" variant="secondary" icon={Icons.plus} onClick={addLine} style={{ marginTop: 4 }}>Add Line</Btn>
    </div>
    <Textarea label="Notes" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Payment terms, thank you note, etc." />

    {/* Payment Plan */}
    {hasExistingInstallments
      ? <div style={{ background: theme.surfaceAlt, borderRadius: theme.radiusSm, padding: "10px 14px", border: `1px solid ${theme.borderLight}`, fontSize: 12, color: theme.textSecondary }}>Payment plan active — mark installments paid from the invoice detail view.</div>
      : <div style={{ background: theme.surfaceAlt, borderRadius: theme.radiusSm, padding: "12px 14px", border: `1px solid ${theme.borderLight}` }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: form.paymentPlan ? 14 : 0 }}>
            <input type="checkbox" checked={form.paymentPlan} onChange={e => set("paymentPlan", e.target.checked)} style={{ accentColor: theme.accent, width: 14, height: 14 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Set up payment plan</span>
          </label>
          {form.paymentPlan && <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Payments</label>
                <select value={form.planPayments} onChange={e => set("planPayments", parseInt(e.target.value))} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: theme.surface }}>
                  {[2, 3, 4, 6, 12].map(n => <option key={n} value={n}>{n} payments</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Interval</label>
                <select value={form.planInterval} onChange={e => set("planInterval", e.target.value)} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: theme.surface }}>
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <Input label="First Payment Date" type="date" value={form.planStartDate} onChange={e => set("planStartDate", e.target.value)} />
            </div>
            {previewInstallments.length > 0 && <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Schedule Preview</div>
              {previewInstallments.map((inst, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${theme.borderLight}`, fontSize: 13 }}>
                <span style={{ color: theme.textSecondary }}>Payment {i + 1} · {fmtDate(inst.dueDate)}</span>
                <span style={{ fontWeight: 600 }}>{fmt(inst.amount)}</span>
              </div>)}
            </div>}
            {form.paymentPlan && !form.planStartDate && <div style={{ fontSize: 12, color: theme.textMuted }}>Set a first payment date to preview the schedule.</div>}
          </>}
        </div>
    }

    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: `1px solid ${theme.borderLight}` }}><div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>Total: {fmt(total)}</div><div style={{ display: "flex", gap: 8 }}><Btn variant="secondary" onClick={onCancel}>Cancel</Btn><Btn onClick={handleSave}>Save Invoice</Btn></div></div>
  </div>;
}

function ClientsView({ data, setModal, setEditItem, deleteClient }) {
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Clients</h1>
      <Btn icon={Icons.plus} onClick={() => setModal("client")}>New Client</Btn>
    </div>
    {data.clients.length === 0 ? <Empty icon={Icons.user} message="No clients yet" /> :
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.clients.map(cl => <div key={cl.id} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: theme.radius, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{cl.name}</div>
            {cl.email && <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>{cl.email}</div>}
            {cl.phone && <div style={{ fontSize: 13, color: theme.textSecondary }}>{cl.phone}</div>}
            {cl.address && <div style={{ fontSize: 13, color: theme.textSecondary, whiteSpace: "pre-line" }}>{cl.address}</div>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Btn size="sm" variant="secondary" icon={Icons.edit} onClick={() => { setEditItem(cl); setModal("client"); }} />
            <Btn size="sm" variant="danger" icon={Icons.trash} onClick={() => deleteClient(cl.id)} />
          </div>
        </div>)}
      </div>}
  </div>;
}

function ClientForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", ...item });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Input label="Name *" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Full name or company" />
    <Input label="Email" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="client@example.com" />
    <Input label="Phone" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 (555) 000-0000" />
    <Textarea label="Address" value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street, City, State ZIP" />
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
      <Btn onClick={() => form.name.trim() && onSave(form)}>Save Client</Btn>
    </div>
  </div>;
}
