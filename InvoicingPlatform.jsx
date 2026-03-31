import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "invoicing_platform_data";

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
const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const today = () => new Date().toISOString().split("T")[0];

const defaultData = {
  categories: [
    { id: genId(), name: "Design", color: "#2D5A3D" },
    { id: genId(), name: "Development", color: "#2B5EA7" },
    { id: genId(), name: "Consulting", color: "#C4841D" },
  ],
  services: [], projects: [], invoices: [], clients: [],
  settings: { sendgridApiKey: "", senderEmail: "", senderName: "", companyName: "", companyAddress: "", companyPhone: "" },
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
  return <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} onClick={onClose}><div onClick={e => e.stopPropagation()} style={{ background: theme.surface, borderRadius: theme.radiusLg, width: "90%", maxWidth: width, maxHeight: "85vh", overflow: "auto", boxShadow: theme.shadowLg, animation: "modalIn 0.2s ease" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${theme.borderLight}` }}><h3 style={{ margin: 0, fontSize: 16, fontFamily: "'Fraunces', serif", fontWeight: 600, color: theme.text }}>{title}</h3><button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, padding: 4 }}>{Icons.close}</button></div><div style={{ padding: "20px" }}>{children}</div></div></div>;
}

function StatCard({ label, value, icon, color = theme.accent }) {
  return <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px 20px", border: `1px solid ${theme.borderLight}`, flex: "1 1 180px", minWidth: 160 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div><div style={{ fontSize: 22, fontWeight: 700, color: theme.text, fontFamily: "'Fraunces', serif" }}>{value}</div></div><div style={{ color, opacity: 0.6 }}>{icon}</div></div></div>;
}

function Empty({ icon, message, action }) {
  return <div style={{ textAlign: "center", padding: "48px 20px", color: theme.textMuted }}><div style={{ opacity: 0.3, marginBottom: 12, display: "flex", justifyContent: "center" }}>{icon}</div><div style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>{message}</div>{action}</div>;
}

function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  const colors = { success: { bg: theme.successLight, color: theme.success, border: "#b8e0ca" }, error: { bg: theme.dangerLight, color: theme.danger, border: "#f5c6c3" }, info: { bg: theme.blueLight, color: theme.blue, border: "#c3d9f5" } };
  const c = colors[type] || colors.success;
  return <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "12px 20px", borderRadius: theme.radiusSm, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", boxShadow: theme.shadowMd, animation: "modalIn 0.2s ease", display: "flex", alignItems: "center", gap: 8, maxWidth: 400 }}>{type === "success" && Icons.check}{message}<button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: c.color, marginLeft: 8, padding: 0 }}>{Icons.close}</button></div>;
}

// ═══════════════════════════════════════
// PDF GENERATION (jsPDF loaded from CDN)
// ═══════════════════════════════════════
let jspdfLoaded = false;
function loadJsPDF() {
  return new Promise((resolve) => {
    if (window.jspdf) { resolve(); return; }
    if (jspdfLoaded) { const check = setInterval(() => { if (window.jspdf) { clearInterval(check); resolve(); } }, 50); return; }
    jspdfLoaded = true;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
    s.onload = () => resolve();
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
  if (settings.senderEmail) doc.text(settings.senderEmail, margin, 40);
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
async function sendInvoiceEmail({ apiKey, senderEmail, senderName, recipientEmail, recipientName, subject, htmlBody, pdfBase64, filename }) {
  const payload = {
    personalizations: [{ to: [{ email: recipientEmail, name: recipientName || "" }], subject }],
    from: { email: senderEmail, name: senderName || senderEmail },
    content: [{ type: "text/html", value: htmlBody }],
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

function buildInvoiceEmailHTML(invoice, settings) {
  const remaining = (invoice.total || 0) - (invoice.amountPaid || 0);
  const rows = (invoice.items || []).map(li => `<tr><td style="padding:10px 14px;border-bottom:1px solid #EDE9E1;font-size:13px;">${li.description || ""}</td><td style="padding:10px 14px;border-bottom:1px solid #EDE9E1;font-size:13px;text-align:center;">${li.qty}</td><td style="padding:10px 14px;border-bottom:1px solid #EDE9E1;font-size:13px;text-align:right;">${fmt(li.rate || 0)}</td><td style="padding:10px 14px;border-bottom:1px solid #EDE9E1;font-size:13px;text-align:right;font-weight:600;">${fmt((li.qty || 0) * (li.rate || 0))}</td></tr>`).join("");
  return `<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;"><div style="background:#2D5A3D;padding:24px 28px;border-radius:8px 8px 0 0;"><h1 style="color:#fff;margin:0;font-size:22px;">${settings.companyName || "Invoice"}</h1><p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">${invoice.number}${invoice.dueDate ? ` &middot; Due ${fmtDate(invoice.dueDate)}` : ""}</p></div><div style="padding:24px 28px;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;"><p style="color:#6B6560;font-size:14px;margin:0 0 20px;">Hi${invoice.clientName ? ` ${invoice.clientName.split(" ")[0]}` : ""},<br><br>Please find your invoice below. A PDF copy is attached for your records.</p><table style="width:100%;border-collapse:collapse;margin-bottom:20px;"><thead><tr style="background:#F0EDE6;"><th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#9C9590;font-weight:600;">Item</th><th style="padding:10px 14px;text-align:center;font-size:11px;text-transform:uppercase;color:#9C9590;font-weight:600;">Qty</th><th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;color:#9C9590;font-weight:600;">Rate</th><th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;color:#9C9590;font-weight:600;">Total</th></tr></thead><tbody>${rows}</tbody></table><div style="text-align:right;padding:14px 0;border-top:2px solid #1A1A1A;"><span style="font-size:20px;font-weight:700;color:#1A1A1A;">Total Due: ${fmt(remaining)}</span></div>${invoice.notes ? `<div style="margin-top:16px;padding:14px;background:#F7F5F0;border-radius:6px;font-size:13px;color:#6B6560;"><strong style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Notes</strong><br>${invoice.notes}</div>` : ""}<p style="color:#9C9590;font-size:12px;margin-top:28px;text-align:center;border-top:1px solid #EDE9E1;padding-top:16px;">Thank you for your business.<br>${settings.senderEmail || ""}</p></div></div>`;
}

// ═══════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════
export default function InvoicingPlatform() {
  const [data, setData] = useState(defaultData);
  const [page, setPage] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadFonts();
    (async () => {
      try {
        if (window.storage) {
          const r = await window.storage.get(STORAGE_KEY);
          if (r?.value) {
            const p = JSON.parse(r.value);
            setData({ ...defaultData, ...p, settings: { ...defaultData.settings, ...(p.settings || {}) } });
          }
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);
  useEffect(() => { if (!loaded || !window.storage) return; window.storage.set(STORAGE_KEY, JSON.stringify(data)).catch(() => {}); }, [data, loaded]);

  const update = (key, val) => setData(d => ({ ...d, [key]: val }));
  const showToast = (message, type = "success") => setToast({ message, type });

  const totalRevenue = data.invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total || 0), 0);
  const outstanding = data.invoices.filter(i => ["sent", "viewed", "partial"].includes(i.status)).reduce((s, i) => s + ((i.total || 0) - (i.amountPaid || 0)), 0);
  const overdueCount = data.invoices.filter(i => i.status === "overdue").length;
  const draftCount = data.invoices.filter(i => i.status === "draft").length;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Icons.dashboard },
    { id: "invoices", label: "Invoices", icon: Icons.invoice },
    { id: "projects", label: "Projects", icon: Icons.project },
    { id: "services", label: "Services", icon: Icons.service },
    { id: "categories", label: "Categories", icon: Icons.category },
    { id: "clients", label: "Clients", icon: Icons.user },
    { id: "reports", label: "Reports", icon: Icons.report },
    { id: "settings", label: "Settings", icon: Icons.settings },
  ];

  // CRUD
  const saveCategory = (cat) => { if (cat.id) update("categories", data.categories.map(c => c.id === cat.id ? cat : c)); else update("categories", [...data.categories, { ...cat, id: genId() }]); setModal(null); setEditItem(null); };
  const deleteCategory = (id) => update("categories", data.categories.filter(c => c.id !== id));
  const saveService = (svc) => { if (svc.id) update("services", data.services.map(s => s.id === svc.id ? svc : s)); else update("services", [...data.services, { ...svc, id: genId() }]); setModal(null); setEditItem(null); };
  const deleteService = (id) => update("services", data.services.filter(s => s.id !== id));
  const saveProject = (proj) => { if (proj.id) update("projects", data.projects.map(p => p.id === proj.id ? proj : p)); else update("projects", [...data.projects, { ...proj, id: genId(), status: "active", createdAt: today() }]); setModal(null); setEditItem(null); };
  const deleteProject = (id) => update("projects", data.projects.filter(p => p.id !== id));
  const saveClient = (client) => { if (client.id) update("clients", data.clients.map(c => c.id === client.id ? client : c)); else update("clients", [...data.clients, { ...client, id: genId() }]); setModal(null); setEditItem(null); };
  const deleteClient = (id) => update("clients", data.clients.filter(c => c.id !== id));

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
  const saveSettings = (s) => { update("settings", s); showToast("Settings saved"); };

  // PDF + Email handlers
  const handleDownloadPDF = async (inv) => {
    const client = data.clients.find(c => c.id === inv.clientId);
    try {
      const { pdfUrl, filename } = await generateInvoicePDF(inv, data.settings, client);
      const a = document.createElement("a"); a.href = pdfUrl; a.download = filename; a.click();
      showToast(`Downloaded ${filename}`);
    } catch (e) { showToast("Failed to generate PDF", "error"); }
  };

  const handleSendEmail = async (inv) => {
    const client = data.clients.find(c => c.id === inv.clientId);
    if (!data.settings.sendgridApiKey) { showToast("Add your SendGrid API key in Settings first", "error"); setPage("settings"); return; }
    if (!client?.email) { showToast("This client has no email address. Add one in Clients.", "error"); return; }
    if (!data.settings.senderEmail) { showToast("Set your sender email in Settings first", "error"); setPage("settings"); return; }
    try {
      const { pdfBase64, filename } = await generateInvoicePDF(inv, data.settings, client);
      const htmlBody = buildInvoiceEmailHTML(inv, data.settings);
      const result = await sendInvoiceEmail({
        apiKey: data.settings.sendgridApiKey, senderEmail: data.settings.senderEmail,
        senderName: data.settings.senderName || data.settings.companyName,
        recipientEmail: client.email, recipientName: client.name,
        subject: `Invoice ${inv.number} from ${data.settings.companyName || "Badjr-Pay"}`,
        htmlBody, pdfBase64, filename,
      });
      if (result.success) { updateInvoiceStatus(inv.id, "sent"); showToast(`Invoice emailed to ${client.email}`); }
      else showToast(`Email failed — check your SendGrid config`, "error");
    } catch (e) { showToast(`Email error: ${e.message}`, "error"); }
  };

  const resetData = async () => { if (confirm("Reset all data?")) { setData(defaultData); try { await window.storage.delete(STORAGE_KEY); } catch {} } };

  if (!loaded) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'DM Sans', sans-serif", color: theme.textMuted }}>Loading...</div>;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: theme.bg, fontFamily: "'DM Sans', sans-serif", color: theme.text }}>
      <style>{`@keyframes modalIn{from{opacity:0;transform:translateY(10px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}} @keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:${theme.border};border-radius:3px} input:focus,select:focus,textarea:focus{border-color:${theme.accent}!important;box-shadow:0 0 0 2px ${theme.accentLight}} button:hover{opacity:0.9} table{border-collapse:collapse} .spin{animation:spin 1s linear infinite}`}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Sidebar */}
      <nav style={{ width: 220, background: theme.surface, borderRight: `1px solid ${theme.borderLight}`, display: "flex", flexDirection: "column", padding: "20px 12px", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: theme.accent, padding: "4px 12px 20px", letterSpacing: "-0.02em" }}>Badjr-Pay</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {navItems.map(n => <button key={n.id} onClick={() => { setPage(n.id); setViewInvoice(null); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "none", borderRadius: theme.radiusSm, cursor: "pointer", background: page === n.id ? theme.accentLight : "transparent", color: page === n.id ? theme.accent : theme.textSecondary, fontWeight: page === n.id ? 600 : 400, fontSize: 13, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", textAlign: "left" }}>{n.icon}{n.label}</button>)}
        </div>
        <button onClick={resetData} style={{ fontSize: 11, color: theme.textMuted, background: "none", border: "none", cursor: "pointer", padding: "8px 12px", textAlign: "left", fontFamily: "'DM Sans', sans-serif" }}>Reset Data</button>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: "24px 28px", maxWidth: 960, overflowY: "auto" }}>
        {page === "dashboard" && <DashboardView {...{ data, totalRevenue, outstanding, overdueCount, draftCount, setPage, setModal, updateInvoiceStatus, handleDownloadPDF, handleSendEmail }} />}
        {page === "invoices" && !viewInvoice && <InvoicesView {...{ data, setModal, setEditItem, setViewInvoice, deleteInvoice, updateInvoiceStatus, handleDownloadPDF, handleSendEmail }} />}
        {page === "invoices" && viewInvoice && <InvoiceDetailView invoice={data.invoices.find(i => i.id === viewInvoice.id) || viewInvoice} data={data} onBack={() => setViewInvoice(null)} updateStatus={updateInvoiceStatus} markPartial={markPartialPayment} handleDownloadPDF={handleDownloadPDF} handleSendEmail={handleSendEmail} />}
        {page === "projects" && <ProjectsView {...{ data, setModal, setEditItem, deleteProject, saveProject }} />}
        {page === "services" && <ServicesView {...{ data, setModal, setEditItem, deleteService }} />}
        {page === "categories" && <CategoriesView {...{ data, setModal, setEditItem, deleteCategory }} />}
        {page === "clients" && <ClientsView {...{ data, setModal, setEditItem, deleteClient }} />}
        {page === "reports" && <ReportsView data={data} />}
        {page === "settings" && <SettingsView settings={data.settings} onSave={saveSettings} />}
      </main>

      {/* Modals */}
      <Modal open={modal === "category"} onClose={() => { setModal(null); setEditItem(null); }} title={editItem ? "Edit Category" : "New Category"}><CategoryForm item={editItem} onSave={saveCategory} onCancel={() => { setModal(null); setEditItem(null); }} /></Modal>
      <Modal open={modal === "service"} onClose={() => { setModal(null); setEditItem(null); }} title={editItem ? "Edit Service" : "New Service"}><ServiceForm item={editItem} categories={data.categories} onSave={saveService} onCancel={() => { setModal(null); setEditItem(null); }} /></Modal>
      <Modal open={modal === "project"} onClose={() => { setModal(null); setEditItem(null); }} title={editItem ? "Edit Project" : "New Project"}><ProjectForm item={editItem} clients={data.clients} onSave={saveProject} onCancel={() => { setModal(null); setEditItem(null); }} /></Modal>
      <Modal open={modal === "client"} onClose={() => { setModal(null); setEditItem(null); }} title={editItem ? "Edit Client" : "New Client"}><ClientForm item={editItem} onSave={saveClient} onCancel={() => { setModal(null); setEditItem(null); }} /></Modal>
      <Modal open={modal === "invoice"} onClose={() => { setModal(null); setEditItem(null); }} title={editItem ? "Edit Invoice" : "New Invoice"} width={640}><InvoiceForm item={editItem} data={data} onSave={saveInvoice} onCancel={() => { setModal(null); setEditItem(null); }} /></Modal>
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

function InvoicesView({ data, setModal, setEditItem, setViewInvoice, deleteInvoice, updateInvoiceStatus, handleDownloadPDF, handleSendEmail }) {
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
                <Btn size="sm" variant="ghost" icon={Icons.edit} onClick={() => { setEditItem(inv); setModal("invoice"); }} />
                <Btn size="sm" variant="ghost" icon={Icons.trash} onClick={() => { if (confirm("Delete?")) deleteInvoice(inv.id); }} style={{ color: theme.danger }} />
              </div>
            </td>
          </tr>)}
        </tbody></table>}
    </div>
  </div>;
}

function InvoiceDetailView({ invoice: inv, data, onBack, updateStatus, markPartial, handleDownloadPDF, handleSendEmail }) {
  const [payAmount, setPayAmount] = useState("");
  const [sending, setSending] = useState(false);
  const remaining = (inv.total || 0) - (inv.amountPaid || 0);
  const client = data.clients.find(c => c.id === inv.clientId);
  const project = data.projects.find(p => p.id === inv.projectId);
  const onSend = async () => { setSending(true); await handleSendEmail(inv); setSending(false); };

  return <div>
    <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: theme.textSecondary, fontSize: 13, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>{Icons.back} Back to Invoices</button>

    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <Btn variant="secondary" icon={Icons.download} onClick={() => handleDownloadPDF(inv)}>Download PDF</Btn>
      <Btn variant="blue" icon={sending ? <span className="spin" style={{ display: "inline-flex" }}>{Icons.spinner}</span> : Icons.mail} onClick={onSend} disabled={sending}>{sending ? "Sending..." : "Email to Client"}</Btn>
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
          {client?.email && <div style={{ fontSize: 13, color: theme.textSecondary }}>{client.email}</div>}
          {client?.phone && <div style={{ fontSize: 13, color: theme.textSecondary }}>{client.phone}</div>}
          {client?.address && <div style={{ fontSize: 13, color: theme.textSecondary, whiteSpace: "pre-line" }}>{client.address}</div>}
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

      {inv.status !== "paid" && <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 16, borderTop: `1px solid ${theme.borderLight}`, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500 }}>Record partial payment:</span>
        <input type="number" placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} style={{ width: 110, padding: "7px 10px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }} />
        <Btn variant="secondary" size="sm" onClick={() => { const amt = parseFloat(payAmount); if (amt > 0) { markPartial(inv.id, amt); setPayAmount(""); } }}>Record Payment</Btn>
      </div>}
    </div>
  </div>;
}

function ProjectsView({ data, setModal, setEditItem, deleteProject, saveProject }) {
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Projects</h1><Btn icon={Icons.plus} onClick={() => setModal("project")}>New Project</Btn></div>
    {data.projects.length === 0 ? <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}` }}><Empty icon={Icons.project} message="No projects yet" action={<Btn size="sm" onClick={() => setModal("project")} icon={Icons.plus}>Create Project</Btn>} /></div> :
      <div style={{ display: "grid", gap: 12 }}>{data.projects.map(p => {
        const cl = data.clients.find(c => c.id === p.clientId); const ic = data.invoices.filter(i => i.projectId === p.id).length; const pr = data.invoices.filter(i => i.projectId === p.id && i.status === "paid").reduce((s, i) => s + (i.total || 0), 0);
        return <div key={p.id} style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{p.name}</div>{cl && <div style={{ fontSize: 12, color: theme.textSecondary }}>{cl.name}</div>}{p.description && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{p.description}</div>}</div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><StatusBadge status={p.status} /><select value={p.status} onChange={e => saveProject({ ...p, status: e.target.value })} style={{ fontSize: 11, border: `1px solid ${theme.border}`, borderRadius: 4, padding: "2px 4px", background: theme.surface, cursor: "pointer" }}><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select><Btn size="sm" variant="ghost" icon={Icons.edit} onClick={() => { setEditItem(p); setModal("project"); }} /><Btn size="sm" variant="ghost" icon={Icons.trash} onClick={() => { if (confirm("Delete?")) deleteProject(p.id); }} style={{ color: theme.danger }} /></div></div>
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

function ClientsView({ data, setModal, setEditItem, deleteClient }) {
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Clients</h1><Btn icon={Icons.plus} onClick={() => setModal("client")}>New Client</Btn></div>
    {data.clients.length === 0 ? <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}` }}><Empty icon={Icons.user} message="No clients yet" action={<Btn size="sm" onClick={() => setModal("client")} icon={Icons.plus}>Add Client</Btn>} /></div> :
      <div style={{ display: "grid", gap: 10 }}>{data.clients.map(c => { const ic = data.invoices.filter(i => i.clientId === c.id).length; const rv = data.invoices.filter(i => i.clientId === c.id && i.status === "paid").reduce((s, i) => s + (i.total || 0), 0); return <div key={c.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "14px 18px", border: `1px solid ${theme.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div><div style={{ fontSize: 12, color: theme.textSecondary }}>{c.email || ""}{c.phone ? ` · ${c.phone}` : ""}</div></div><div style={{ display: "flex", alignItems: "center", gap: 16 }}><span style={{ fontSize: 12, color: theme.textMuted }}>{ic} invoices · {fmt(rv)}</span><div style={{ display: "flex", gap: 4 }}><Btn size="sm" variant="ghost" icon={Icons.edit} onClick={() => { setEditItem(c); setModal("client"); }} /><Btn size="sm" variant="ghost" icon={Icons.trash} onClick={() => { if (confirm("Delete?")) deleteClient(c.id); }} style={{ color: theme.danger }} /></div></div></div>; })}</div>}
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
      const k = inv.clientId || inv.clientName || "Unknown";
      const name = inv.clientName || data.clients.find(c => c.id === inv.clientId)?.name || "Unknown";
      if (!buckets[k]) buckets[k] = { name, revenue: 0, count: 0, outstanding: 0 };
      buckets[k].revenue += inv.total || 0;
      buckets[k].count++;
    });
    allInvoices.filter(i => ["sent", "viewed", "partial"].includes(i.status)).forEach(inv => {
      const k = inv.clientId || inv.clientName || "Unknown";
      const name = inv.clientName || data.clients.find(c => c.id === inv.clientId)?.name || "Unknown";
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
function SettingsView({ settings, onSave }) {
  const [form, setForm] = useState({ ...settings });
  const [showKey, setShowKey] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return <div>
    <h1 style={{ margin: "0 0 20px", fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Settings</h1>

    <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, padding: "20px 24px", marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 4px", fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600 }}>Company Information</h3>
      <p style={{ fontSize: 12, color: theme.textMuted, margin: "0 0 14px" }}>Appears on your PDF invoices and emails.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Company Name" value={form.companyName || ""} onChange={e => set("companyName", e.target.value)} placeholder="DakJen Creative LLC" />
        <Input label="Phone" value={form.companyPhone || ""} onChange={e => set("companyPhone", e.target.value)} placeholder="(555) 123-4567" />
      </div>
      <div style={{ marginTop: 12 }}><Input label="Address" value={form.companyAddress || ""} onChange={e => set("companyAddress", e.target.value)} placeholder="123 Main St, Washington, DC" /></div>
    </div>

    <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600 }}>SendGrid Email Integration</h3>
        {form.sendgridApiKey && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: theme.successLight, color: theme.success, fontWeight: 600 }}>Connected</span>}
      </div>
      <p style={{ fontSize: 12, color: theme.textMuted, margin: "4px 0 14px" }}>Emails invoices as beautifully formatted HTML with a PDF attachment. Get your API key from <span style={{ color: theme.blue, fontWeight: 500 }}>app.sendgrid.com → Settings → API Keys</span>. Make sure your sender email is verified.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 }}>SendGrid API Key</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input type={showKey ? "text" : "password"} value={form.sendgridApiKey || ""} onChange={e => set("sendgridApiKey", e.target.value)} placeholder="SG.xxxxxxxx..." style={{ flex: 1, padding: "8px 12px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", background: theme.surface, color: theme.text }} />
            <Btn variant="ghost" size="sm" onClick={() => setShowKey(!showKey)}>{showKey ? "Hide" : "Show"}</Btn>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Sender Email (must be verified in SendGrid)" value={form.senderEmail || ""} onChange={e => set("senderEmail", e.target.value)} placeholder="invoices@yourcompany.com" />
          <Input label="Sender Name" value={form.senderName || ""} onChange={e => set("senderName", e.target.value)} placeholder="DakJen Creative" />
        </div>
      </div>
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

function ProjectForm({ item, clients, onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", description: "", clientId: "", ...item });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Input label="Project Name" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Website Redesign" />
    <Textarea label="Description" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Project details..." />
    <Select label="Client" value={form.clientId} onChange={e => set("clientId", e.target.value)}><option value="">No Client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}><Btn variant="secondary" onClick={onCancel}>Cancel</Btn><Btn onClick={() => form.name.trim() && onSave(form)}>Save</Btn></div>
  </div>;
}

function ClientForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", ...item });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Input label="Client Name" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Acme Corp" />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Input label="Email" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="client@email.com" /><Input label="Phone" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(555) 123-4567" /></div>
    <Textarea label="Address" value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Main St..." />
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}><Btn variant="secondary" onClick={onCancel}>Cancel</Btn><Btn onClick={() => form.name.trim() && onSave(form)}>Save</Btn></div>
  </div>;
}

function InvoiceForm({ item, data, onSave, onCancel }) {
  const [form, setForm] = useState({ clientId: "", clientName: "", projectId: "", dueDate: "", notes: "", items: [{ description: "", qty: 1, rate: 0 }], ...item });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setLI = (i, k, v) => { const items = [...form.items]; items[i] = { ...items[i], [k]: v }; set("items", items); };
  const addLine = () => set("items", [...form.items, { description: "", qty: 1, rate: 0 }]);
  const removeLine = (i) => set("items", form.items.filter((_, idx) => idx !== i));
  const addSvc = (svcId) => { const svc = data.services.find(s => s.id === svcId); if (svc) set("items", [...form.items, { description: svc.name, qty: 1, rate: svc.rate || 0 }]); };
  const selClient = (cId) => { const c = data.clients.find(x => x.id === cId); set("clientId", cId); set("clientName", c?.name || ""); };
  const total = form.items.reduce((s, li) => s + ((parseFloat(li.qty) || 0) * (parseFloat(li.rate) || 0)), 0);
  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Select label="Client" value={form.clientId} onChange={e => selClient(e.target.value)}><option value="">Select Client</option>{data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select><Select label="Project (optional)" value={form.projectId} onChange={e => set("projectId", e.target.value)}><option value="">No Project</option>{data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
    {!form.clientId && <Input label="Client Name (manual)" value={form.clientName} onChange={e => set("clientName", e.target.value)} placeholder="Type client name" />}
    <Input label="Due Date" type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><label style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Line Items</label>{data.services.length > 0 && <Select style={{ fontSize: 11, padding: "4px 8px" }} onChange={e => { if (e.target.value) { addSvc(e.target.value); e.target.value = ""; } }}><option value="">+ Add Service</option>{data.services.map(s => <option key={s.id} value={s.id}>{s.name} ({fmt(s.rate)})</option>)}</Select>}</div>
      {form.items.map((li, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 60px 100px 30px", gap: 6, marginBottom: 6, alignItems: "end" }}><Input placeholder="Description" value={li.description} onChange={e => setLI(i, "description", e.target.value)} /><Input placeholder="Qty" type="number" value={li.qty} onChange={e => setLI(i, "qty", e.target.value)} /><Input placeholder="Rate" type="number" value={li.rate} onChange={e => setLI(i, "rate", e.target.value)} />{form.items.length > 1 && <button onClick={() => removeLine(i)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.danger, padding: "8px 4px" }}>{Icons.trash}</button>}</div>)}
      <Btn size="sm" variant="secondary" icon={Icons.plus} onClick={addLine} style={{ marginTop: 4 }}>Add Line</Btn>
    </div>
    <Textarea label="Notes" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Payment terms, thank you note, etc." />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: `1px solid ${theme.borderLight}` }}><div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>Total: {fmt(total)}</div><div style={{ display: "flex", gap: 8 }}><Btn variant="secondary" onClick={onCancel}>Cancel</Btn><Btn onClick={() => (form.clientName || form.clientId) && onSave(form)}>Save Invoice</Btn></div></div>
  </div>;
}
