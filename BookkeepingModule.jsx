"use client";
import { useState, useEffect, useRef } from "react";
import { estimateTaxes, nextQuarterlyDue } from "./lib/tax";
import { readHash, writeHash } from "./lib/hash-state";
import { LOGO_PNG_DATA_URL, LOGO_ASPECT } from "./lib/logo-data";
import { jsPDF } from "jspdf";

// ── Shared helpers (duplicated from InvoicingPlatform to avoid refactoring monolith) ──
const theme = {
  bg: "#F7F5F0", surface: "#FFFFFF", surfaceAlt: "#F0EDE6",
  border: "#E2DDD3", borderLight: "#EDE9E1",
  text: "#1A1A1A", textSecondary: "#6B6560", textMuted: "#9C9590",
  accent: "#476C2E", accentLight: "#EAF1E3", accentHover: "#3A5A25",
  warning: "#B8811A", warningLight: "#FFF3DC",
  danger: "#8A1C1C", dangerLight: "#F7E5E5",
  success: "#3F7A2E", successLight: "#E6F1DE",
  blue: "#0B2D65", blueLight: "#E6ECF7",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
  radius: "10px", radiusSm: "6px", radiusLg: "14px",
};

const genId = () => Math.random().toString(36).substr(2, 9);
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const fmtDate = (d) => { if (!d) return "—"; try { const s = String(d).trim(); const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date(s).toISOString().split("T")[0]; const [y, m, day] = iso.split("-"); return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return "—"; } };
const today = () => new Date().toISOString().split("T")[0];

// ── Shared UI Components ──
function Btn({ children, onClick, variant = "primary", size = "md", icon, style: sx, disabled, ...props }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, borderRadius: theme.radiusSm, transition: "all 0.15s ease", whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1 };
  const sizes = { sm: { padding: "6px 12px", fontSize: 12 }, md: { padding: "8px 16px", fontSize: 13 }, lg: { padding: "10px 20px", fontSize: 14 } };
  const variants = { primary: { background: theme.accent, color: "#fff" }, secondary: { background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}` }, ghost: { background: "transparent", color: theme.textSecondary }, danger: { background: theme.dangerLight, color: theme.danger }, success: { background: theme.successLight, color: theme.success }, blue: { background: theme.blueLight, color: theme.blue } };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...sx }} {...props}>{icon}{children}</button>;
}

function Input({ label, ...props }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{label && <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{label}</label>}<input {...props} style={{ padding: "8px 12px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", background: theme.surface, color: theme.text, ...props.style }} /></div>;
}

function Select({ label, children, ...props }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{label && <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{label}</label>}<select {...props} style={{ padding: "8px 12px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", background: theme.surface, color: theme.text, cursor: "pointer", ...props.style }}>{children}</select></div>;
}

function Textarea({ label, ...props }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{label && <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{label}</label>}<textarea {...props} style={{ padding: "8px 12px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", background: theme.surface, color: theme.text, resize: "vertical", minHeight: 60, ...props.style }} /></div>;
}

function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  return <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} onClick={onClose}><div onClick={e => e.stopPropagation()} style={{ background: theme.surface, borderRadius: `${theme.radiusLg} ${theme.radiusLg} 0 0`, width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", animation: "modalIn 0.2s ease" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${theme.borderLight}` }}><h3 style={{ margin: 0, fontSize: 16, fontFamily: "'Fraunces', serif", fontWeight: 600, color: theme.text }}>{title}</h3><button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, padding: 4 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div style={{ padding: "20px" }}>{children}</div></div></div>;
}

function StatCard({ label, value, icon, color = theme.accent }) {
  return <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px 20px", border: `1px solid ${theme.borderLight}`, flex: "1 1 180px", minWidth: 160 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div><div style={{ fontSize: 22, fontWeight: 700, color: theme.text, fontFamily: "'Fraunces', serif" }}>{value}</div></div>{icon && <div style={{ color, opacity: 0.6 }}>{icon}</div>}</div></div>;
}

function Empty({ message }) {
  return <div style={{ textAlign: "center", padding: "48px 20px", color: theme.textMuted }}><div style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>{message}</div></div>;
}

// ── Icons ──
const BkIcons = {
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  trash: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  edit: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  upload: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  dollar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  alert: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
};

// ── CSV Parsing ──
function parseCSV(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line) => {
    const fields = [];
    let current = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { fields.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    fields.push(current.trim());
    return fields;
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

// ── CSV Export ──
function exportCSV(rows, filename) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── API helpers ──
async function bkFetch(params = {}) {
  const qs = new URLSearchParams();
  if (params.year) qs.set("year", params.year);
  if (params.month) qs.set("month", params.month);
  if (params.report) qs.set("report", params.report);
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  const r = await fetch(`/api/bookkeeping?${qs}`);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Load failed");
  return r.json();
}

async function bkPost(action, data) {
  const r = await fetch("/api/bookkeeping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || "Action failed");
  }
  return r.json();
}

// ═══════════════════════════════════════
// MAIN SHELL
// ═══════════════════════════════════════
// Reporting period → { start, end, asOf, label, tag }. YTD/quarters cap at today so "as of" never runs into the future.
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function periodRange(year, period) {
  const pad = (n) => String(n).padStart(2, "0");
  const lastDay = (m) => new Date(year, m, 0).getDate();
  const todayIso = today();
  const cap = (iso) => (iso > todayIso ? todayIso : iso);
  let start = `${year}-01-01`, end = `${year}-12-31`, label = `January – December ${year}`, tag = `${year}`;
  if (period === "ytd") { end = cap(end); label = `Year to date (Jan 1 – ${fmtDate(end)})`; tag = `${year}_YTD`; }
  else if (/^q[1-4]$/.test(period)) {
    // Quarterly financials are cumulative: Q3 = Jan 1 through Sep 30 (balance sheet as of quarter end)
    const q = Number(period[1]); const m3 = q * 3;
    end = cap(`${year}-${pad(m3)}-${pad(lastDay(m3))}`);
    label = `Through Q${q} ${year} (Jan 1 – ${fmtDate(end)})`; tag = `${year}_Q${q}`;
  }
  else if (/^m\d{1,2}$/.test(period)) { const m = Number(period.slice(1)); start = `${year}-${pad(m)}-01`; end = `${year}-${pad(m)}-${pad(lastDay(m))}`; label = `${MONTH_NAMES[m - 1]} ${year}`; tag = `${year}_${pad(m)}`; }
  return { start, end, asOf: cap(end), label, tag, period };
}

const BK_TABS = ["dashboard", "people", "ledger", "pnl", "balance_sheet", "reconcile", "accounts", "import"];
export function BookkeepingShell({ session, showToast }) {
  const initial = readHash();
  const [tab, setTab] = useState(BK_TABS.includes(initial.sub) ? initial.sub : "dashboard");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState(parseInt(initial.params.year) || new Date().getFullYear());
  const [period, setPeriod] = useState(/^(year|ytd|q[1-4]|m\d{1,2})$/.test(initial.params.period || "") ? initial.params.period : "year"); // year | ytd | q1..q4 | m1..m12
  useEffect(() => { writeHash("bookkeeping", tab, { year: filterYear, period: period === "year" ? "" : period }); }, [tab, filterYear, period]);
  const range = periodRange(filterYear, period);

  const role = session?.user?.role || "owner";
  const canEdit = role === "owner" || role === "admin";
  const canInput = canEdit || role === "team_member";
  const isReadOnly = role === "accountant";

  const reload = async () => {
    try {
      setLoading(true);
      const d = await bkFetch({ year: filterYear, start: range.start, end: range.end });
      setData(d);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [filterYear, period]);

  const act = async (action, payload) => {
    try {
      await bkPost(action, payload);
      await reload();
      return true;
    } catch (e) {
      showToast(e.message, "error");
      return false;
    }
  };

  const tabs = [
    { id: "dashboard", label: "Overview" },
    { id: "people", label: "Payroll & Contractors" },
    { id: "ledger", label: "Ledger" },
    { id: "pnl", label: "P&L" },
    { id: "balance_sheet", label: "Balance Sheet" },
    { id: "reconcile", label: "Reconcile" },
    { id: "accounts", label: "Chart of Accounts" },
    { id: "import", label: "Import" },
  ];

  const years = [];
  for (let y = new Date().getFullYear(); y >= 2026; y--) years.push(y);
  const months = ["All Months", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
      <h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Bookkeeping</h1>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} style={{ padding: "6px 10px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: theme.surface }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: "6px 10px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: theme.surface }}>
          <option value="year">Full year</option>
          <option value="ytd">Year to date</option>
          <option value="q1">Through Q1 (Jan–Mar)</option><option value="q2">Through Q2 (Jan–Jun)</option><option value="q3">Through Q3 (Jan–Sep)</option><option value="q4">Through Q4 (full year)</option>
          {months.slice(1).map((m, i) => <option key={m} value={`m${i + 1}`}>{m}</option>)}
        </select>
      </div>
    </div>

    {/* Tab bar */}
    <div style={{ display: "flex", gap: 2, marginBottom: 20, overflowX: "auto", borderBottom: `1px solid ${theme.borderLight}`, paddingBottom: 0 }}>
      {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{
        padding: "8px 14px", border: "none", borderBottom: tab === t.id ? `2px solid ${theme.accent}` : "2px solid transparent",
        background: "transparent", color: tab === t.id ? theme.accent : theme.textSecondary,
        fontWeight: tab === t.id ? 600 : 400, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
        cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
      }}>{t.label}</button>)}
    </div>

    {loading && !data ? <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Loading...</div> : data && <>
      {tab === "dashboard" && <BkDashboard data={data} filterYear={filterYear} onGoTo={setTab} />}
      {tab === "ledger" && <LedgerView data={data} act={act} showToast={showToast} canInput={canInput} canEdit={canEdit} />}
      {tab === "import" && (canInput ? <CSVImportView data={data} act={act} showToast={showToast} reload={reload} /> : <Empty message="You don't have permission to import data." />)}
      {tab === "reconcile" && <ReconcileView data={data} act={act} showToast={showToast} canInput={canInput} />}
      {tab === "people" && <>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: theme.textSecondary, margin: "4px 0 10px" }}>Payroll (W-2)</div>
        <PayrollView data={data} act={act} showToast={showToast} canInput={canInput} canEdit={canEdit} />
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: theme.textSecondary, margin: "32px 0 10px", paddingTop: 24, borderTop: `1px solid ${theme.borderLight}` }}>Contractors (1099)</div>
        <ContractorView data={data} act={act} showToast={showToast} canEdit={canEdit} filterYear={filterYear} />
      </>}
      {tab === "pnl" && <PnLView filterYear={filterYear} range={range} showToast={showToast} data={data} act={act} companyName={data?.companyName} />}
      {tab === "balance_sheet" && <BalanceSheetView filterYear={filterYear} range={range} showToast={showToast} data={data} act={act} companyName={data?.companyName} />}
      {tab === "accounts" && <ChartOfAccountsView data={data} act={act} showToast={showToast} canEdit={canEdit} />}
    </>}
  </div>;
}

// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
const CHART_COLORS = ["#2E8B57", "#0B2D65", "#B8811A"]; // validated categorical trio (light surface)
const monthKeyOf = (iso) => String(iso || "").slice(0, 7);
const monthLabel = (key) => { const [y, m] = key.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }); };
const shiftMonth = (key, n) => { const [y, m] = key.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const addInterval = (iso, interval, count = 1) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = interval === "year" ? new Date(y + count, m - 1, d) : interval === "week" ? new Date(y, m - 1, d + 7 * count) : new Date(y, m - 1 + count, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};
const fmtK = (n) => Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;

function useMeasuredWidth(ref, fallback = 640) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => { const cw = entries[0]?.contentRect?.width; if (cw) setW(Math.max(280, Math.floor(cw))); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return w;
}

// Column chart: stacked or grouped, thin marks, hairline grid, per-band hover tooltip, legend for ≥2 series, table toggle.
function ColumnChart({ buckets, series, stacked = true, height = 260, emptyMessage = "Nothing to show yet" }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const wrapRef = useRef(null);
  const W = useMeasuredWidth(wrapRef);
  const H = height, padL = 56, padR = 16, padT = 26, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const totalOf = (b) => series.reduce((t, sr) => t + (b.values[sr.key] || 0), 0);
  const max = Math.max(0, ...buckets.map(b => stacked ? totalOf(b) : Math.max(...series.map(sr => b.values[sr.key] || 0))));
  const niceMax = (() => { if (max <= 0) return 100; const p = Math.pow(10, Math.floor(Math.log10(max))); const n = max / p; const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10; return step * p; })();
  const y = (v) => padT + plotH - (v / niceMax) * plotH;
  const band = plotW / Math.max(1, buckets.length);
  const groupW = stacked ? Math.min(28, band * 0.55) : Math.min(24 * series.length + 2 * (series.length - 1), band * 0.7);
  const barW = stacked ? groupW : (groupW - 2 * (series.length - 1)) / series.length;
  const maxIdx = buckets.reduce((bi, b, i) => (totalOf(b) > totalOf(buckets[bi]) ? i : bi), 0);
  const allZero = max <= 0;
  const roundedTop = (x, top, w, h) => { const r = Math.min(4, h, w / 2); return `M${x},${top + h} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z`; };

  return <div>
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", fontFamily: "'DM Sans', sans-serif" }} role="img">
        {[0, 0.25, 0.5, 0.75, 1].map(f => <g key={f}><line x1={padL} x2={W - padR} y1={y(f * niceMax)} y2={y(f * niceMax)} stroke={theme.borderLight} strokeWidth="1" /><text x={padL - 8} y={y(f * niceMax) + 4} textAnchor="end" fontSize="11" fill={theme.textMuted}>{fmtK(f * niceMax)}</text></g>)}
        {buckets.map((b, i) => {
          const x0 = padL + i * band + (band - groupW) / 2;
          let acc = 0;
          const marks = series.map((sr, si) => {
            const v = b.values[sr.key] || 0;
            if (v <= 0) return null;
            if (stacked) {
              const top = y(acc + v), bottom = y(acc); acc += v;
              const h = Math.max(0, bottom - top - (si > 0 ? 2 : 0));
              const isTop = series.slice(si + 1).every(s2 => !(b.values[s2.key] > 0));
              return <path key={sr.key} d={isTop ? roundedTop(x0, bottom - h, barW, h) : `M${x0},${bottom - h} h${barW} v${h} h${-barW} z`} fill={sr.color} opacity={hover === i ? 0.75 : 1} />;
            }
            const x = x0 + si * (barW + 2), top = y(v), h = padT + plotH - top;
            return <path key={sr.key} d={roundedTop(x, top, barW, h)} fill={sr.color} opacity={hover === i ? 0.75 : 1} />;
          });
          const total = totalOf(b);
          return <g key={b.key}>
            {marks}
            {stacked && i === maxIdx && total > 0 && <text x={x0 + barW / 2} y={y(total) - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill={theme.textSecondary}>{fmtK(total)}</text>}
            <text x={padL + i * band + band / 2} y={H - 9} textAnchor="middle" fontSize="11" fill={b.current ? theme.text : theme.textMuted} fontWeight={b.current ? 600 : 400}>{b.label}</text>
            <rect x={padL + i * band} y={padT} width={band} height={plotH + padB} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
          </g>;
        })}
        <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke={theme.border} strokeWidth="1" />
      </svg>
      {hover != null && <div style={{ position: "absolute", left: `${((padL + hover * band + band / 2) / W) * 100}%`, top: 0, transform: `translate(${hover >= buckets.length / 2 ? "-100%" : "0"}, 0)`, background: theme.text, color: "#fff", borderRadius: 6, padding: "8px 10px", fontSize: 12, pointerEvents: "none", boxShadow: theme.shadowMd, whiteSpace: "nowrap", zIndex: 2 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, opacity: 0.85 }}>{buckets[hover].label}</div>
        {series.map(sr => <div key={sr.key} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 2, background: sr.color, display: "inline-block" }} />{sr.label}</span><b>{fmt(buckets[hover].values[sr.key] || 0)}</b></div>)}
        {stacked && series.length > 1 && <div style={{ borderTop: "1px solid rgba(255,255,255,0.25)", marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between", gap: 8 }}><span>Total</span><b>{fmt(totalOf(buckets[hover]))}</b></div>}
      </div>}
      {allZero && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: theme.textMuted, fontSize: 13, pointerEvents: "none" }}>{emptyMessage}</div>}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, flexWrap: "wrap", gap: 8 }}>
      {series.length > 1 ? <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{series.map(sr => <span key={sr.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: theme.textSecondary }}><span style={{ width: 10, height: 10, borderRadius: 2, background: sr.color, display: "inline-block" }} />{sr.label}</span>)}</div> : <span />}
      <button onClick={() => setShowTable(v => !v)} style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>{showTable ? "Hide table" : "Show as table"}</button>
    </div>
    {showTable && <table style={{ width: "100%", marginTop: 6, fontSize: 12 }}><thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}><th style={{ textAlign: "left", padding: "6px 8px", color: theme.textMuted, fontWeight: 600 }}>Month</th>{series.map(sr => <th key={sr.key} style={{ textAlign: "right", padding: "6px 8px", color: theme.textMuted, fontWeight: 600 }}>{sr.label}</th>)}</tr></thead><tbody>
      {buckets.map(b => <tr key={b.key} style={{ borderBottom: `1px solid ${theme.borderLight}` }}><td style={{ padding: "6px 8px" }}>{b.label}</td>{series.map(sr => <td key={sr.key} style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(b.values[sr.key] || 0)}</td>)}</tr>)}
    </tbody></table>}
  </div>;
}

// Suggest which unlinked income deposits look like payments for open invoices (amount match, name hint).
const monthlyOf = (p) => { const per = (p.amount || 0); const n = p.intervalCount || 1; return p.interval === "year" ? per / (12 * n) : p.interval === "week" ? per * 52 / 12 / n : per / n; };
function suggestInvoiceMatches(transactions, invoices) {
  const open = (invoices || []).filter(i => i.status !== "draft" && (i.total || 0) - (i.amountPaid || 0) > 0.005);
  const near = (a, b) => Math.abs(a - b) < 0.011;
  const out = [];
  for (const t of transactions || []) {
    if (t.type !== "income" || t.invoiceId || !(t.amount > 0)) continue;
    const text = `${t.name || ""} ${t.description || ""} ${t.vendor || ""} ${t.reference || ""}`.toLowerCase();
    for (const inv of open) {
      const balance = (inv.total || 0) - (inv.amountPaid || 0);
      const amounts = [balance, inv.total, inv.deposit, ...(inv.installments || []).filter(x => x.status !== "paid").map(x => x.amount)].filter(a => a > 0);
      const amountHit = amounts.some(a => near(a, t.amount));
      const words = (inv.clientName || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !["llc", "inc", "the", "and"].includes(w));
      const nameHit = words.some(w => text.includes(w));
      if (!amountHit && !nameHit) continue;
      const score = (amountHit ? 2 : 0) + (nameHit ? 1 : 0) + (near(balance, t.amount) ? 1 : 0);
      if (score < 2) continue;
      out.push({ tx: t, invoice: inv, score, amountHit, nameHit, key: `${t.id}:${inv.id}` });
    }
  }
  out.sort((a, b) => b.score - a.score || (b.tx.date || "").localeCompare(a.tx.date || ""));
  const seen = new Set();
  return out.filter(m => { if (seen.has(m.tx.id)) return false; seen.add(m.tx.id); return true; });
}
const dismissedKey = "bk_dismissed_matches";
const getDismissed = () => { try { return new Set(JSON.parse(localStorage.getItem(dismissedKey) || "[]")); } catch { return new Set(); } };
const addDismissed = (k) => { try { const d = getDismissed(); d.add(k); localStorage.setItem(dismissedKey, JSON.stringify([...d])); } catch {} };

function SuggestedMatches({ data, act, showToast, canInput, compact = false, onReview }) {
  const [dismissed, setDismissed] = useState(() => (typeof window === "undefined" ? new Set() : getDismissed()));
  const [busy, setBusy] = useState(null);
  const matches = suggestInvoiceMatches(data.transactions, data.invoices).filter(m => !dismissed.has(m.key));
  if (matches.length === 0) return null;
  if (compact) return <div style={{ background: theme.blueLight, borderRadius: theme.radiusSm, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: theme.blue, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
    <span><b>{matches.length}</b> deposit{matches.length === 1 ? " looks" : "s look"} like invoice payment{matches.length === 1 ? "" : "s"} — approve to mark {matches.length === 1 ? "it" : "them"} paid.</span>
    <Btn size="sm" variant="blue" onClick={onReview}>Review in Reconcile</Btn>
  </div>;
  const approve = async (m) => {
    setBusy(m.key);
    const ok = await act("upsert_transaction", { ...m.tx, invoiceId: m.invoice.id, reviewed: true });
    setBusy(null);
    if (ok) showToast(`${m.invoice.number} marked ${Math.abs(((m.invoice.total || 0) - (m.invoice.amountPaid || 0)) - m.tx.amount) < 0.011 ? "paid" : "partially paid"} from the ${fmtDate(m.tx.date)} deposit`);
  };
  const dismiss = (m) => { addDismissed(m.key); setDismissed(getDismissed()); };
  return <div style={{ background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius, marginBottom: 20, overflow: "hidden" }}>
    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${theme.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontWeight: 600, fontSize: 14, fontFamily: "'Fraunces', serif" }}>Suggested invoice matches</span>
      <span style={{ fontSize: 12, color: theme.textMuted }}>Approving applies the deposit to the invoice and marks it paid</span>
    </div>
    {matches.map(m => {
      const balance = (m.invoice.total || 0) - (m.invoice.amountPaid || 0);
      return <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: `1px solid ${theme.borderLight}`, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(m.tx.amount)} deposit · {fmtDate(m.tx.date)}</div>
          <div style={{ fontSize: 12, color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.tx.name || m.tx.description || m.tx.reference}</div>
        </div>
        <div style={{ color: theme.textMuted, fontSize: 18 }}>→</div>
        <div style={{ flex: "1 1 200px" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{m.invoice.number} · {m.invoice.clientName || "—"}</div>
          <div style={{ fontSize: 12, color: theme.textMuted }}>{fmt(balance)} due{m.amountHit ? " · amount matches" : ""}{m.nameHit ? " · client name in memo" : ""}</div>
        </div>
        {canInput && <div style={{ display: "flex", gap: 6 }}>
          <Btn size="sm" variant="success" icon={BkIcons.check} disabled={busy === m.key} onClick={() => approve(m)}>Approve</Btn>
          <Btn size="sm" variant="ghost" onClick={() => dismiss(m)}>Not a match</Btn>
        </div>}
      </div>;
    })}
  </div>;
}

function TaxCard({ tax, card, h3, sub }) {
  const [open, setOpen] = useState(false);
  if (!tax) return null;
  const est = estimateTaxes({ netIncome: tax.netIncomeYtd, owners: tax.owners, filing: tax.filing, state: tax.state, localRate: tax.localRate });
  const due = nextQuarterlyDue();
  const pct = (est.effectiveRate * 100).toFixed(1);
  return <div style={{ ...card, marginBottom: 20 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
      <div>
        <h3 style={h3}>Estimated taxes to set aside</h3>
        <div style={sub}>On {fmt(est.profit)} profit so far in {tax.year} · {est.stateName} · {est.owners} owner{est.owners === 1 ? "" : "s"}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 700, color: theme.danger, lineHeight: 1 }}>{fmt(est.total)}</div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>≈ {pct}% of profit · {fmt(est.perOwner.total)} per owner</div>
      </div>
    </div>
    {est.profit <= 0 ? <div style={{ fontSize: 13, color: theme.textMuted }}>No taxable profit yet this year.</div> : <>
      <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
        {est.rows.map(r => <div key={r.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${theme.borderLight}` }}><span style={{ color: theme.textSecondary }}>{r.label}</span><span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(r.amount)}</span></div>)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: theme.textSecondary }}>Next {due.label} due <b>{fmtDate(due.iso)}</b>. Jurisdiction and filing status are in Settings → Taxes.</div>
        <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>{open ? "Hide assumptions" : "How this is calculated"}</button>
      </div>
      {open && <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>{est.assumptions.map((a, i) => <li key={i}>{a}</li>)}<li>An estimate for planning, not tax advice — your accountant can refine it.</li></ul>}
    </>}
  </div>;
}

function BkDashboard({ data, filterYear, onGoTo }) {
  const [allTx, setAllTx] = useState(null);   // unfiltered ledger for the trailing-6-month chart
  const [plans, setPlans] = useState([]);      // recurring plans (Stripe) for the forecast
  useEffect(() => {
    bkFetch({}).then(d => setAllTx(d.transactions || [])).catch(() => setAllTx([]));
    fetch("/api/billing?view=subscriptions", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => setPlans(d?.subscriptions || [])).catch(() => {});
  }, []);

  const income = data.transactions.filter(t => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
  const expenses = data.transactions.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
  const net = income - expenses;
  const unreconciled = data.transactions.filter(t => !t.reconciled).length;
  const openInvoices = (data.invoices || []).filter(i => i.status !== "draft" && (i.total || 0) - (i.amountPaid || 0) > 0.005);
  const receivables = openInvoices.reduce((s, i) => s + ((i.total || 0) - (i.amountPaid || 0)), 0);

  // Trailing 6 months: money in vs out, from the ledger
  const thisMonth = monthKeyOf(today());
  const pastKeys = Array.from({ length: 6 }, (_, i) => shiftMonth(thisMonth, i - 5));
  const past = pastKeys.map(k => ({ key: k, label: monthLabel(k), current: k === thisMonth, values: { in: 0, out: 0 } }));
  for (const t of allTx || []) {
    const b = past.find(p => p.key === monthKeyOf(t.date));
    if (!b) continue;
    if (t.type === "income") b.values.in += Math.abs(t.amount);
    else if (t.type === "expense") b.values.out += Math.abs(t.amount);
  }

  // Next 6 months: what's expected in — invoice balances by due date, payment-plan installments, recurring plans
  const futureKeys = Array.from({ length: 6 }, (_, i) => shiftMonth(thisMonth, i));
  const future = futureKeys.map(k => ({ key: k, label: monthLabel(k), current: k === thisMonth, values: { invoices: 0, installments: 0, recurring: 0 } }));
  const bucketFor = (iso) => { const k = monthKeyOf(iso); const key = k && k > thisMonth ? k : thisMonth; return future.find(b => b.key === key) || null; }; // beyond the window → not shown
  for (const inv of openInvoices) {
    const balance = (inv.total || 0) - (inv.amountPaid || 0);
    const pending = (inv.installments || []).filter(x => x.status !== "paid");
    if (pending.length) {
      let left = balance;
      for (const inst of pending) { const amt = Math.min(inst.amount, left); if (amt <= 0) break; const b = bucketFor(inst.dueDate); if (b) b.values.installments += amt; left -= amt; }
    } else {
      const b = bucketFor(inv.dueDate); if (b) b.values.invoices += balance;
    }
  }
  const lastKey = futureKeys[futureKeys.length - 1];
  const RECUR_MONTHS = { month: 1, quarter: 3, year: 12 };
  for (const inv of data.invoices || []) {
    if (!inv.recurring || !RECUR_MONTHS[inv.recurring] || inv.status === "draft") continue;
    let d = inv.recurringNext || addInterval(inv.dueDate || today(), "month", RECUR_MONTHS[inv.recurring]);
    for (let guard = 0; guard < 12 && monthKeyOf(d) <= lastKey; guard++) {
      const b = future.find(x => x.key === monthKeyOf(d)) || (monthKeyOf(d) < thisMonth ? future[0] : null);
      if (b) b.values.recurring += inv.total || 0;
      d = addInterval(d, "month", RECUR_MONTHS[inv.recurring]);
    }
  }
  for (const p of plans) {
    if (!["active", "trialing", "past_due"].includes(p.status) || !p.currentPeriodEnd || p.cancelAtPeriodEnd) continue;
    let d = p.currentPeriodEnd;
    for (let guard = 0; guard < 40 && monthKeyOf(d) <= lastKey; guard++) {
      const b = future.find(x => x.key === monthKeyOf(d)) || (monthKeyOf(d) < thisMonth ? future[0] : null);
      if (b) b.values.recurring += p.amount || 0;
      d = addInterval(d, p.interval || "month", p.intervalCount || 1);
    }
  }
  const expected6 = future.reduce((s, b) => s + b.values.invoices + b.values.installments + b.values.recurring, 0);

  // Category spend breakdown
  const catMap = {};
  for (const c of data.categories) catMap[c.id] = c.name;
  const spendByCategory = {};
  for (const t of data.transactions) {
    if (t.type !== "expense") continue;
    const catName = catMap[t.categoryId] || "Uncategorized";
    spendByCategory[catName] = (spendByCategory[catName] || 0) + Math.abs(t.amount);
  }
  const sortedSpend = Object.entries(spendByCategory).sort((a, b) => b[1] - a[1]);

  // 1099 alerts
  const flagged = [];
  for (const c of data.contractors) {
    const totals = data.contractorTotals[c.id];
    if (totals && totals[filterYear] && totals[filterYear].flagged) flagged.push({ name: c.name, total: totals[filterYear].total });
  }


  const card = { background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius, padding: 20 };
  const h3 = { margin: "0 0 4px", fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600 };
  const sub = { fontSize: 12, color: theme.textMuted, marginBottom: 14 };

  return <div>
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
      <StatCard label="Income" value={fmt(income)} color={theme.success} />
      <StatCard label="Expenses" value={fmt(expenses)} color={theme.danger} />
      <StatCard label="Net Income" value={fmt(net)} color={net >= 0 ? theme.success : theme.danger} />
      <StatCard label="Receivables" value={fmt(receivables)} color={theme.blue} />
    </div>
    <SuggestedMatches data={data} compact onReview={() => onGoTo && onGoTo("reconcile")} />

    {flagged.length > 0 && <div style={{ background: theme.warningLight, border: `1px solid ${theme.warning}`, borderRadius: theme.radiusSm, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: theme.warning, display: "flex", alignItems: "center", gap: 6 }}>{BkIcons.alert} 1099 Threshold Alerts ({filterYear})</div>
      {flagged.map((f, i) => <div key={i} style={{ color: theme.text, padding: "2px 0" }}>{f.name}: {fmt(f.total)} paid</div>)}
    </div>}

    <div style={{ ...card, marginBottom: 20 }}>
      <h3 style={h3}>Money in vs. out</h3>
      <div style={sub}>Last 6 months, from the ledger</div>
      {allTx === null ? <div style={{ color: theme.textMuted, fontSize: 13, padding: "60px 0", textAlign: "center" }}>Loading…</div> :
        <ColumnChart buckets={past} stacked={false} series={[{ key: "in", label: "Money in", color: CHART_COLORS[0] }, { key: "out", label: "Money out", color: CHART_COLORS[2] }]} emptyMessage="No ledger activity in the last 6 months" />}
    </div>
    <div style={{ ...card, marginBottom: 20 }}>
      <h3 style={h3}>Expected income</h3>
      <div style={sub}>Next 6 months · {fmt(expected6)} scheduled from open invoices, payment plans and recurring plans</div>
      <ColumnChart buckets={future} stacked series={[{ key: "invoices", label: "Invoices due", color: CHART_COLORS[0] }, { key: "installments", label: "Payment plans", color: CHART_COLORS[1] }, { key: "recurring", label: "Recurring plans", color: CHART_COLORS[2] }]} emptyMessage="Nothing scheduled — send an invoice or set up a recurring plan" />
    </div>
    <TaxCard tax={data.tax} card={card} h3={h3} sub={sub} />

    <div style={card}>
      <h3 style={{ ...h3, marginBottom: 14 }}>Spending by Category</h3>
      {sortedSpend.length === 0 ? <div style={{ color: theme.textMuted, fontSize: 13 }}>No expenses recorded yet.</div> :
        sortedSpend.map(([cat, total]) => {
          const pct = expenses > 0 ? (total / expenses) * 100 : 0;
          return <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: theme.text }}>{cat}</span>
              <span style={{ fontWeight: 600 }}>{fmt(total)}</span>
            </div>
            <div style={{ background: theme.surfaceAlt, borderRadius: 4, height: 6, overflow: "hidden" }}>
              <div style={{ background: theme.accent, height: "100%", width: `${pct}%`, borderRadius: 4, transition: "width 0.3s" }} />
            </div>
          </div>;
        })}
    </div>
  </div>;
}

// ═══════════════════════════════════════
// LEDGER VIEW
// ═══════════════════════════════════════
function LedgerView({ data, act, showToast, canInput, canEdit }) {
  const [modal, setModal] = useState(null); // null | 'add' | transaction object
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  const filtered = data.transactions.filter(t => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterCat !== "all" && t.categoryId !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return (t.description || "").toLowerCase().includes(q) || (t.name || "").toLowerCase().includes(q) || (t.vendor || "").toLowerCase().includes(q);
    }
    return true;
  });

  const catMap = {};
  for (const c of data.categories) catMap[c.id] = c.name;

  const handleSave = async (txn) => {
    const ok = await act("upsert_transaction", { ...txn, id: txn.id || genId() });
    if (ok) { setModal(null); showToast("Transaction saved"); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this transaction?")) return;
    const ok = await act("delete_transaction", { id });
    if (ok) showToast("Transaction deleted");
  };

  const handleExport = () => {
    exportCSV(filtered.map(t => ({
      Date: t.date, Name: t.name, Description: t.description, Category: catMap[t.categoryId] || "",
      Type: t.type, Amount: t.amount, Vendor: t.vendor, Reference: t.reference,
      Reconciled: t.reconciled ? "Yes" : "No",
    })), `transactions_${today()}.csv`);
    showToast("Exported transactions CSV");
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ padding: "7px 12px 7px 30px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", background: theme.surface, width: 200 }} />
          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: theme.textMuted }}>{BkIcons.search}</span>
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: "7px 10px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: theme.surface }}>
          <option value="all">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="equity">Owner equity</option>
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ padding: "7px 10px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: theme.surface }}>
          <option value="all">All Categories</option>
          {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn size="sm" variant="secondary" icon={BkIcons.download} onClick={handleExport}>Export CSV</Btn>
        {canInput && <Btn size="sm" icon={BkIcons.plus} onClick={() => setModal("add")}>Add Transaction</Btn>}
      </div>
    </div>

    {filtered.length === 0 ? <Empty message="No transactions found." /> :
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.borderLight}` }}>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Name / Description</th>
              <th style={thStyle}>Category</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
              <th style={thStyle}>Status</th>
              {(canInput || canEdit) && <th style={{ ...thStyle, width: 80 }}></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => <tr key={t.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
              <td style={tdStyle}>{fmtDate(t.date)}</td>
              <td style={tdStyle}>
                <div style={{ fontWeight: 500 }}>{t.name || t.description || "—"}</div>
                {t.name && t.description && <div style={{ fontSize: 11, color: theme.textMuted }}>{t.description}</div>}
                {t.vendor && <div style={{ fontSize: 11, color: theme.textMuted }}>Vendor: {t.vendor}</div>}
                {t.invoiceId && <div style={{ fontSize: 11, color: theme.accent, fontWeight: 600, marginTop: 2 }}>→ Applied to {(data.invoices || []).find(i => i.id === t.invoiceId)?.number || "invoice"}</div>}
              </td>
              <td style={tdStyle}><span style={{ fontSize: 12, color: theme.textSecondary }}>{catMap[t.categoryId] || "—"}</span></td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: t.amount >= 0 ? theme.success : theme.danger }}>{t.amount >= 0 ? "+" : "-"}{fmt(Math.abs(t.amount))}</td>
              <td style={tdStyle}>
                {t.reconciled ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: theme.successLight, color: theme.success, fontWeight: 600 }}>Reconciled</span>
                  : t.reviewed ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: theme.blueLight, color: theme.blue, fontWeight: 600 }}>Reviewed</span>
                  : <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: theme.surfaceAlt, color: theme.textMuted, fontWeight: 500 }}>Pending</span>}
              </td>
              {(canInput || canEdit) && <td style={{ ...tdStyle, display: "flex", gap: 4 }}>
                {canInput && <button onClick={() => setModal(t)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textSecondary, padding: 4 }}>{BkIcons.edit}</button>}
                {canEdit && <button onClick={() => handleDelete(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.danger, padding: 4 }}>{BkIcons.trash}</button>}
              </td>}
            </tr>)}
          </tbody>
        </table>
      </div>}

    <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "Add Transaction" : "Edit Transaction"} width={560}>
      <TransactionForm item={modal === "add" ? null : modal} categories={data.categories} accounts={data.accounts} invoices={data.invoices || []} onSave={handleSave} onCancel={() => setModal(null)} />
    </Modal>
  </div>;
}

const thStyle = { textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'DM Sans', sans-serif" };
const tdStyle = { padding: "10px 10px", verticalAlign: "top" };

// ── Transaction Form ──
function TransactionForm({ item, categories, accounts, invoices = [], onSave, onCancel }) {
  const [form, setForm] = useState({
    date: today(), description: "", name: "", amount: "", categoryId: "", accountId: "",
    type: "expense", vendor: "", reference: "", notes: "",
    ...item,
    amount: item ? String(Math.abs(item.amount)) : "",
    type: item ? (item.type === "equity" ? (item.amount < 0 ? "draw" : "contribution") : item.type) : "expense",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const storedType = (t) => (t === "contribution" || t === "draw" ? "equity" : t);
  const isNegative = (t) => t === "expense" || t === "draw";

  const handleSubmit = () => {
    if (!form.date || !form.amount) return;
    const amt = parseFloat(form.amount) || 0;
    onSave({ ...form, type: storedType(form.type), amount: isNegative(form.type) ? -Math.abs(amt) : Math.abs(amt), invoiceId: form.type === "income" ? (form.invoiceId || null) : null });
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Input label="Date *" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
      <Select label="Type *" value={form.type} onChange={e => { const t = e.target.value; setForm(f => ({ ...f, type: t, categoryId: t === "contribution" ? "bkc_owner_contrib" : t === "draw" ? "bkc_owner_draws" : (categories.find(c => c.id === f.categoryId)?.type === storedType(t) ? f.categoryId : "") })); }}>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
        <option value="contribution">Owner contribution (money in, not income)</option>
        <option value="draw">Owner draw (money out, not an expense)</option>
      </Select>
    </div>
    {form.type === "income" && (() => {
      const open = invoices.filter(i => i.id === form.invoiceId || ((i.total || 0) - (i.amountPaid || 0) > 0.005 && i.status !== "draft"));
      return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Select label="Apply to invoice" value={form.invoiceId || ""} onChange={e => set("invoiceId", e.target.value || null)}>
          <option value="">— Not an invoice payment —</option>
          {open.map(i => <option key={i.id} value={i.id}>{i.number} · {i.clientName || "—"} · {fmt((i.total || 0) - (i.amountPaid || 0))} due</option>)}
        </Select>
        <div style={{ fontSize: 11, color: theme.textMuted }}>Applying a deposit settles that invoice (paid / partial) and keeps it out of P&L income, since the invoice already carries the revenue.</div>
      </div>;
    })()}
    <Input label="Name" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Label for this transaction" />
    <Input label="Description" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Details" />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Input label="Amount *" type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" min="0" step="0.01" />
      <Input label="Vendor" value={form.vendor} onChange={e => set("vendor", e.target.value)} placeholder="Vendor name" />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Select label="Category" value={form.categoryId} onChange={e => set("categoryId", e.target.value)}>
        <option value="">Uncategorized</option>
        {categories.filter(c => c.type === storedType(form.type)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Select label="Account" value={form.accountId} onChange={e => set("accountId", e.target.value)}>
        <option value="">No Account</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>
    </div>
    <Input label="Reference / Check #" value={form.reference} onChange={e => set("reference", e.target.value)} placeholder="Optional" />
    <Textarea label="Notes" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optional notes" />
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
      <Btn onClick={handleSubmit}>Save</Btn>
    </div>
  </div>;
}

// ═══════════════════════════════════════
// CSV IMPORT
// ═══════════════════════════════════════
function CSVImportView({ data, act, showToast, reload }) {
  const [step, setStep] = useState(1); // 1=upload, 2=map, 3=preview, 4=done
  const [csv, setCsv] = useState(null);
  const [mapping, setMapping] = useState({});
  const [accountId, setAccountId] = useState("");
  const [defaultCat, setDefaultCat] = useState("");
  const [negIsExpense, setNegIsExpense] = useState(true);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      if (parsed.headers.length === 0) { showToast("Could not parse CSV", "error"); return; }
      setCsv(parsed);
      // Auto-detect common column names
      const auto = {};
      const h = parsed.headers.map(x => x.toLowerCase());
      const dateIdx = h.findIndex(x => x === "date" || x === "trans date" || x === "transaction date" || x === "posted date");
      const descIdx = h.findIndex(x => x === "description" || x === "memo" || x === "narration" || x === "details");
      const amtIdx = h.findIndex(x => x === "amount" || x === "total");
      const debitIdx = h.findIndex(x => x === "debit" || x === "withdrawal" || x === "withdrawals");
      const creditIdx = h.findIndex(x => x === "credit" || x === "deposit" || x === "deposits");
      const refIdx = h.findIndex(x => x === "reference" || x === "check" || x === "check no" || x === "check number" || x === "ref");
      if (dateIdx >= 0) auto.date = String(dateIdx);
      if (descIdx >= 0) auto.description = String(descIdx);
      if (amtIdx >= 0) auto.amount = String(amtIdx);
      if (debitIdx >= 0) auto.debit = String(debitIdx);
      if (creditIdx >= 0) auto.credit = String(creditIdx);
      if (refIdx >= 0) auto.reference = String(refIdx);
      setMapping(auto);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const mapFields = ["date", "description", "amount", "debit", "credit", "reference"];

  const getMappedRows = () => {
    if (!csv) return [];
    return csv.rows.map(row => {
      const date = mapping.date !== undefined ? row[parseInt(mapping.date)] || "" : "";
      const desc = mapping.description !== undefined ? row[parseInt(mapping.description)] || "" : "";
      const ref = mapping.reference !== undefined ? row[parseInt(mapping.reference)] || "" : "";
      let amount = 0;
      if (mapping.amount !== undefined) {
        amount = parseFloat((row[parseInt(mapping.amount)] || "0").replace(/[^0-9.\-]/g, "")) || 0;
      } else if (mapping.debit !== undefined || mapping.credit !== undefined) {
        const debit = mapping.debit !== undefined ? parseFloat((row[parseInt(mapping.debit)] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
        const credit = mapping.credit !== undefined ? parseFloat((row[parseInt(mapping.credit)] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
        amount = credit - debit;
      }
      const isExpense = negIsExpense ? amount < 0 : amount > 0;
      return { date, description: desc, reference: ref, amount, type: isExpense ? "expense" : "income" };
    }).filter(r => r.date);
  };

  const handleImport = async () => {
    const rows = getMappedRows();
    if (rows.length === 0) { showToast("No valid rows to import", "error"); return; }
    const batchId = genId();
    const transactions = rows.map(r => ({
      id: genId(), date: r.date, description: r.description, name: "",
      amount: r.type === "expense" ? -Math.abs(r.amount) : Math.abs(r.amount),
      categoryId: defaultCat || null, accountId: accountId || null,
      type: r.type, vendor: "", reference: r.reference, notes: "",
      reconciled: false, reviewed: false, source: "csv_import", importBatchId: batchId,
    }));
    const ok = await act("bulk_import_transactions", { transactions });
    if (ok) {
      setImportResult({ count: transactions.length, batchId });
      setStep(4);
      showToast(`Imported ${transactions.length} transactions`);
    }
  };

  const handleUndo = async () => {
    if (!importResult) return;
    const ok = await act("delete_batch", { batchId: importResult.batchId });
    if (ok) {
      showToast("Import undone");
      setStep(1); setCsv(null); setMapping({}); setImportResult(null);
    }
  };

  const preview = getMappedRows().slice(0, 20);

  return <div>
    {step === 1 && <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ marginBottom: 16, color: theme.textSecondary, fontSize: 14 }}>Upload a CSV file from your bank or financial institution.</div>
      <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
      <Btn icon={BkIcons.upload} onClick={() => fileRef.current?.click()}>Choose CSV File</Btn>
    </div>}

    {step === 2 && csv && <div>
      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, margin: "0 0 14px" }}>Map Columns</h3>
      <p style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 16 }}>Detected {csv.headers.length} columns and {csv.rows.length} rows. Map each field below:</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {mapFields.map(field => <Select key={field} label={field.charAt(0).toUpperCase() + field.slice(1) + (field === "date" ? " *" : field === "amount" ? " (or use Debit/Credit)" : "")} value={mapping[field] ?? ""} onChange={e => setMapping(m => ({ ...m, [field]: e.target.value || undefined }))}>
          <option value="">— Skip —</option>
          {csv.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
        </Select>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Select label="Target Account" value={accountId} onChange={e => setAccountId(e.target.value)}>
          <option value="">No account</option>
          {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select label="Default Category" value={defaultCat} onChange={e => setDefaultCat(e.target.value)}>
          <option value="">Uncategorized</option>
          {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: theme.text, marginBottom: 16, cursor: "pointer" }}>
        <input type="checkbox" checked={negIsExpense} onChange={e => setNegIsExpense(e.target.checked)} style={{ accentColor: theme.accent }} />
        Negative amounts are expenses
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="secondary" onClick={() => { setStep(1); setCsv(null); setMapping({}); }}>Back</Btn>
        <Btn onClick={() => { if (!mapping.date) { showToast("Please map the Date column", "error"); return; } if (!mapping.amount && !mapping.debit && !mapping.credit) { showToast("Please map Amount or Debit/Credit columns", "error"); return; } setStep(3); }}>Preview</Btn>
      </div>
    </div>}

    {step === 3 && <div>
      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, margin: "0 0 14px" }}>Preview ({getMappedRows().length} rows)</h3>
      <div style={{ overflowX: "auto", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.borderLight}` }}>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Description</th>
              <th style={thStyle}>Reference</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
              <th style={thStyle}>Type</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r, i) => <tr key={i} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
              <td style={tdStyle}>{r.date}</td>
              <td style={tdStyle}>{r.description}</td>
              <td style={tdStyle}>{r.reference}</td>
              <td style={{ ...tdStyle, textAlign: "right", color: r.type === "income" ? theme.success : theme.danger }}>{r.type === "income" ? "+" : "-"}{fmt(Math.abs(r.amount))}</td>
              <td style={tdStyle}>{r.type}</td>
            </tr>)}
          </tbody>
        </table>
        {getMappedRows().length > 20 && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 8 }}>Showing first 20 of {getMappedRows().length} rows</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="secondary" onClick={() => setStep(2)}>Back</Btn>
        <Btn onClick={handleImport}>Import {getMappedRows().length} Transactions</Btn>
      </div>
    </div>}

    {step === 4 && importResult && <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{BkIcons.check}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: theme.success }}>Imported {importResult.count} transactions</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
        <Btn variant="danger" size="sm" onClick={handleUndo}>Undo Import</Btn>
        <Btn size="sm" onClick={() => { setStep(1); setCsv(null); setMapping({}); setImportResult(null); }}>Import Another</Btn>
      </div>
    </div>}
  </div>;
}

// ═══════════════════════════════════════
// RECONCILIATION
// ═══════════════════════════════════════
function ReconcileView({ data, act, showToast, canInput }) {
  const [selected, setSelected] = useState(new Set());
  const unreconciled = data.transactions.filter(t => !t.reconciled);

  const catMap = {};
  for (const c of data.categories) catMap[c.id] = c.name;

  const toggle = (id) => setSelected(s => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectAll = () => setSelected(new Set(unreconciled.map(t => t.id)));
  const clearAll = () => setSelected(new Set());

  const handleReconcile = async () => {
    if (selected.size === 0) return;
    const ok = await act("reconcile_transactions", { ids: [...selected] });
    if (ok) { setSelected(new Set()); showToast(`Reconciled ${selected.size} transactions`); }
  };

  const handleReview = async () => {
    if (selected.size === 0) return;
    const ok = await act("review_transactions", { ids: [...selected] });
    if (ok) { setSelected(new Set()); showToast(`Marked ${selected.size} as reviewed`); }
  };

  return <div>
    <SuggestedMatches data={data} act={act} showToast={showToast} canInput={canInput} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
      <div style={{ fontSize: 14, color: theme.textSecondary }}>{unreconciled.length} unreconciled transaction{unreconciled.length !== 1 ? "s" : ""}</div>
      {canInput && <div style={{ display: "flex", gap: 8 }}>
        <Btn size="sm" variant="ghost" onClick={selected.size === unreconciled.length ? clearAll : selectAll}>{selected.size === unreconciled.length ? "Deselect All" : "Select All"}</Btn>
        <Btn size="sm" variant="blue" onClick={handleReview} disabled={selected.size === 0}>Mark Reviewed ({selected.size})</Btn>
        <Btn size="sm" variant="success" onClick={handleReconcile} disabled={selected.size === 0}>Reconcile ({selected.size})</Btn>
      </div>}
    </div>

    {unreconciled.length === 0 ? <Empty message="All transactions are reconciled." /> :
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.borderLight}` }}>
              {canInput && <th style={{ ...thStyle, width: 36 }}></th>}
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Name / Description</th>
              <th style={thStyle}>Category</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {unreconciled.map(t => <tr key={t.id} style={{ borderBottom: `1px solid ${theme.borderLight}`, background: selected.has(t.id) ? theme.accentLight : "transparent" }}>
              {canInput && <td style={tdStyle}><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} style={{ accentColor: theme.accent }} /></td>}
              <td style={tdStyle}>{fmtDate(t.date)}</td>
              <td style={tdStyle}><div style={{ fontWeight: 500 }}>{t.name || t.description || "—"}</div></td>
              <td style={tdStyle}><span style={{ fontSize: 12, color: theme.textSecondary }}>{catMap[t.categoryId] || "—"}</span></td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: t.amount >= 0 ? theme.success : theme.danger }}>{t.amount >= 0 ? "+" : "-"}{fmt(Math.abs(t.amount))}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
  </div>;
}

// ═══════════════════════════════════════
// PAYROLL VIEW
// ═══════════════════════════════════════
function PayrollView({ data, act, showToast, canInput, canEdit }) {
  const [modal, setModal] = useState(null);

  const handleSave = async (record) => {
    const ok = await act("upsert_payroll", { ...record, id: record.id || genId() });
    if (ok) { setModal(null); showToast("Payroll record saved"); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this payroll record and its linked transaction?")) return;
    const ok = await act("delete_payroll", { id });
    if (ok) showToast("Payroll record deleted");
  };

  const handleExport = () => {
    exportCSV(data.payroll.map(p => ({
      Employee: p.employeeName, "Pay Date": p.payDate,
      "Period Start": p.payPeriodStart, "Period End": p.payPeriodEnd,
      "Gross Pay": p.grossPay, "Net Pay": p.netPay,
      "Federal Withholding": p.federalWithholding, "State Withholding": p.stateWithholding,
      "FICA SS": p.ficaSs, "FICA Medicare": p.ficaMedicare,
      "Employer SS": p.ficaEmployerSs, "Employer Medicare": p.ficaEmployerMedicare,
      "Other Deductions": p.otherDeductions, Notes: p.notes,
    })), `payroll_${today()}.csv`);
    showToast("Exported payroll CSV");
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
      <div style={{ fontSize: 14, color: theme.textSecondary }}>{data.payroll.length} payroll record{data.payroll.length !== 1 ? "s" : ""}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn size="sm" variant="secondary" icon={BkIcons.download} onClick={handleExport}>Export CSV</Btn>
        {canInput && <Btn size="sm" icon={BkIcons.plus} onClick={() => setModal("add")}>Add Payroll</Btn>}
      </div>
    </div>

    {data.payroll.length === 0 ? <Empty message="No payroll records yet." /> :
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.payroll.map(p => <div key={p.id} style={{ background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{p.employeeName}</div>
              <div style={{ fontSize: 12, color: theme.textSecondary }}>{fmtDate(p.payDate)} {p.payPeriodStart && p.payPeriodEnd ? `(${fmtDate(p.payPeriodStart)} - ${fmtDate(p.payPeriodEnd)})` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {canInput && <Btn size="sm" variant="secondary" icon={BkIcons.edit} onClick={() => setModal(p)} />}
              {canEdit && <Btn size="sm" variant="danger" icon={BkIcons.trash} onClick={() => handleDelete(p.id)} />}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, fontSize: 12 }}>
            <div><span style={{ color: theme.textMuted }}>Gross:</span> <span style={{ fontWeight: 600 }}>{fmt(p.grossPay)}</span></div>
            <div><span style={{ color: theme.textMuted }}>Net:</span> <span style={{ fontWeight: 600 }}>{fmt(p.netPay)}</span></div>
            <div><span style={{ color: theme.textMuted }}>Federal:</span> {fmt(p.federalWithholding)}</div>
            <div><span style={{ color: theme.textMuted }}>State:</span> {fmt(p.stateWithholding)}</div>
            <div><span style={{ color: theme.textMuted }}>SS:</span> {fmt(p.ficaSs)}</div>
            <div><span style={{ color: theme.textMuted }}>Medicare:</span> {fmt(p.ficaMedicare)}</div>
            {(p.ficaEmployerSs > 0 || p.ficaEmployerMedicare > 0) && <>
              <div><span style={{ color: theme.textMuted }}>Emp. SS:</span> {fmt(p.ficaEmployerSs)}</div>
              <div><span style={{ color: theme.textMuted }}>Emp. Med:</span> {fmt(p.ficaEmployerMedicare)}</div>
            </>}
          </div>
          {p.notes && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 6 }}>{p.notes}</div>}
        </div>)}
      </div>}

    <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "Add Payroll Record" : "Edit Payroll Record"} width={600}>
      <PayrollForm item={modal === "add" ? null : modal} onSave={handleSave} onCancel={() => setModal(null)} />
    </Modal>
  </div>;
}

function PayrollForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState({
    employeeName: "", payDate: today(), payPeriodStart: "", payPeriodEnd: "",
    grossPay: "", netPay: "", federalWithholding: "", stateWithholding: "",
    ficaSs: "", ficaMedicare: "", ficaEmployerSs: "", ficaEmployerMedicare: "",
    otherDeductions: "", notes: "",
    ...item,
    grossPay: item ? String(item.grossPay) : "",
    netPay: item ? String(item.netPay) : "",
    federalWithholding: item ? String(item.federalWithholding) : "",
    stateWithholding: item ? String(item.stateWithholding) : "",
    ficaSs: item ? String(item.ficaSs) : "",
    ficaMedicare: item ? String(item.ficaMedicare) : "",
    ficaEmployerSs: item ? String(item.ficaEmployerSs) : "",
    ficaEmployerMedicare: item ? String(item.ficaEmployerMedicare) : "",
    otherDeductions: item ? String(item.otherDeductions) : "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const numField = (label, key) => <Input label={label} type="number" value={form[key]} onChange={e => set(key, e.target.value)} placeholder="0.00" min="0" step="0.01" />;

  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Input label="Employee Name *" value={form.employeeName} onChange={e => set("employeeName", e.target.value)} placeholder="Full name" />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
      <Input label="Pay Date *" type="date" value={form.payDate} onChange={e => set("payDate", e.target.value)} />
      <Input label="Period Start" type="date" value={form.payPeriodStart} onChange={e => set("payPeriodStart", e.target.value)} />
      <Input label="Period End" type="date" value={form.payPeriodEnd} onChange={e => set("payPeriodEnd", e.target.value)} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {numField("Gross Pay *", "grossPay")}
      {numField("Net Pay *", "netPay")}
    </div>
    <div style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>Withholdings</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {numField("Federal", "federalWithholding")}
      {numField("State", "stateWithholding")}
    </div>
    <div style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>FICA (Employee)</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {numField("Social Security", "ficaSs")}
      {numField("Medicare", "ficaMedicare")}
    </div>
    <div style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>FICA (Employer)</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {numField("Employer SS", "ficaEmployerSs")}
      {numField("Employer Medicare", "ficaEmployerMedicare")}
    </div>
    {numField("Other Deductions", "otherDeductions")}
    <Textarea label="Notes" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optional notes" />
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
      <Btn onClick={() => form.employeeName.trim() && form.payDate && onSave(form)}>Save</Btn>
    </div>
  </div>;
}

// ═══════════════════════════════════════
// CONTRACTOR VIEW
// ═══════════════════════════════════════
function ContractorView({ data, act, showToast, canEdit, filterYear }) {
  const [modal, setModal] = useState(null); // null | 'addContractor' | contractor | 'addPayment'
  const [payModal, setPayModal] = useState(null); // null | { contractorId }
  const [expandedId, setExpandedId] = useState(null);

  const handleSaveContractor = async (c) => {
    const ok = await act("upsert_contractor", { ...c, id: c.id || genId() });
    if (ok) { setModal(null); showToast("Contractor saved"); }
  };

  const handleDeleteContractor = async (id) => {
    if (!confirm("Delete this contractor and all their payment records?")) return;
    const ok = await act("delete_contractor", { id });
    if (ok) showToast("Contractor deleted");
  };

  const handleSavePayment = async (cp) => {
    const ok = await act("upsert_contractor_payment", { ...cp, id: cp.id || genId() });
    if (ok) { setPayModal(null); showToast("Payment recorded"); }
  };

  const handleDeletePayment = async (id) => {
    if (!confirm("Delete this payment?")) return;
    const ok = await act("delete_contractor_payment", { id });
    if (ok) showToast("Payment deleted");
  };

  const handleExport = () => {
    exportCSV(data.contractors.map(c => {
      const totals = data.contractorTotals[c.id]?.[filterYear];
      return {
        Name: c.name, "Business Name": c.businessName, "EIN (last 4)": c.einLast4,
        Email: c.email, [`${filterYear} Total Paid`]: totals?.total || 0,
        "1099 Required": totals?.flagged ? "Yes" : "No",
      };
    }), `contractors_1099_${filterYear}.csv`);
    showToast("Exported contractor summary CSV");
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
      <div style={{ fontSize: 14, color: theme.textSecondary }}>{data.contractors.length} contractor{data.contractors.length !== 1 ? "s" : ""}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn size="sm" variant="secondary" icon={BkIcons.download} onClick={handleExport}>Export 1099 Summary</Btn>
        {canEdit && <Btn size="sm" icon={BkIcons.plus} onClick={() => setModal("addContractor")}>Add Contractor</Btn>}
      </div>
    </div>

    {data.contractors.length === 0 ? <Empty message="No contractors yet." /> :
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.contractors.map(c => {
          const totals = data.contractorTotals[c.id]?.[filterYear];
          const flagged = totals?.flagged;
          const payments = data.contractorPayments.filter(cp => cp.contractorId === c.id);
          const expanded = expandedId === c.id;
          return <div key={c.id} style={{ background: theme.surface, border: `1px solid ${flagged ? theme.warning : theme.borderLight}`, borderRadius: theme.radius, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ cursor: "pointer", flex: 1 }} onClick={() => setExpandedId(expanded ? null : c.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</span>
                  {flagged && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: theme.warningLight, color: theme.warning, fontWeight: 700 }}>1099 REQUIRED</span>}
                </div>
                {c.businessName && <div style={{ fontSize: 12, color: theme.textSecondary }}>{c.businessName}</div>}
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  <span style={{ color: theme.textMuted }}>{filterYear} Total:</span>{" "}
                  <span style={{ fontWeight: 600, color: flagged ? theme.warning : theme.text }}>{fmt(totals?.total || 0)}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {canEdit && <Btn size="sm" variant="blue" icon={BkIcons.plus} onClick={() => setPayModal({ contractorId: c.id })}>Payment</Btn>}
                {canEdit && <Btn size="sm" variant="secondary" icon={BkIcons.edit} onClick={() => setModal(c)} />}
                {canEdit && <Btn size="sm" variant="danger" icon={BkIcons.trash} onClick={() => handleDeleteContractor(c.id)} />}
              </div>
            </div>
            {expanded && payments.length > 0 && <div style={{ marginTop: 12, borderTop: `1px solid ${theme.borderLight}`, paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Payment History</div>
              {payments.map(cp => <div key={cp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 13, borderBottom: `1px solid ${theme.borderLight}` }}>
                <div>
                  <span style={{ color: theme.textSecondary }}>{fmtDate(cp.payDate)}</span>
                  {cp.description && <span style={{ color: theme.textMuted }}> — {cp.description}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{fmt(cp.amount)}</span>
                  {canEdit && <button onClick={() => handleDeletePayment(cp.id)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.danger, padding: 2 }}>{BkIcons.trash}</button>}
                </div>
              </div>)}
            </div>}
          </div>;
        })}
      </div>}

    <Modal open={modal === "addContractor" || (modal && modal.id)} onClose={() => setModal(null)} title={modal === "addContractor" ? "Add Contractor" : "Edit Contractor"}>
      <ContractorForm item={modal === "addContractor" ? null : modal} onSave={handleSaveContractor} onCancel={() => setModal(null)} />
    </Modal>

    <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Record Contractor Payment">
      {payModal && <ContractorPaymentForm contractorId={payModal.contractorId} onSave={handleSavePayment} onCancel={() => setPayModal(null)} />}
    </Modal>
  </div>;
}

function ContractorForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", businessName: "", einLast4: "", email: "", address: "", ...item });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Input label="Contractor Name *" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Individual name" />
    <Input label="Business Name" value={form.businessName} onChange={e => set("businessName", e.target.value)} placeholder="DBA or LLC name" />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Input label="EIN (last 4 digits)" value={form.einLast4} onChange={e => set("einLast4", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="XXXX" maxLength={4} />
      <Input label="Email" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" />
    </div>
    <Textarea label="Address" value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street, City, State ZIP" />
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
      <Btn onClick={() => form.name.trim() && onSave(form)}>Save</Btn>
    </div>
  </div>;
}

function ContractorPaymentForm({ contractorId, onSave, onCancel }) {
  const [form, setForm] = useState({ contractorId, payDate: today(), amount: "", description: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Input label="Pay Date *" type="date" value={form.payDate} onChange={e => set("payDate", e.target.value)} />
      <Input label="Amount *" type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" min="0" step="0.01" />
    </div>
    <Input label="Description" value={form.description} onChange={e => set("description", e.target.value)} placeholder="What was this payment for?" />
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
      <Btn onClick={() => form.payDate && form.amount && onSave(form)}>Save Payment</Btn>
    </div>
  </div>;
}

// ═══════════════════════════════════════
// P&L REPORT
// ═══════════════════════════════════════
function PnLView({ filterYear, range, showToast, data, act, companyName }) {
  const [pnlData, setPnlData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ date: today(), description: "", amount: "", categoryId: "", accountId: "" });
  const [saving, setSaving] = useState(false);

  const startDate = range.start;
  const endDate = range.end;

  const fetchPnl = () => {
    setLoading(true);
    bkFetch({ report: "pnl", start: startDate, end: endDate })
      .then(d => setPnlData(d.pnl))
      .catch(e => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPnl(); }, [startDate, endDate]);

  const handleAddExpense = async () => {
    if (!expenseForm.date || !expenseForm.amount || !expenseForm.description) {
      showToast("Date, description, and amount are required", "error");
      return;
    }
    setSaving(true);
    const ok = await act("upsert_transaction", {
      id: genId(),
      date: expenseForm.date,
      name: expenseForm.description,
      description: expenseForm.description,
      amount: -Math.abs(parseFloat(expenseForm.amount)),
      categoryId: expenseForm.categoryId || null,
      accountId: expenseForm.accountId || null,
      type: "expense",
      vendor: "", reference: "", notes: "",
      reconciled: false, reviewed: false, source: "manual",
    });
    setSaving(false);
    if (ok) {
      showToast("Expense added");
      setExpenseForm({ date: today(), description: "", amount: "", categoryId: "", accountId: "" });
      setExpenseOpen(false);
      fetchPnl();
    }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Loading...</div>;
  if (!pnlData) return <Empty message="No P&L data available." />;

  const { categories: catRows = [], invoiceRevenue = 0, invoiceCount = 0 } = pnlData;

  // Group by sections
  const income = catRows.filter(r => r.type === "income" && r.total > 0);
  const cogs = catRows.filter(r => (r.categoryId === "bkc_cogs" || r.parent === "bkc_cogs") && r.total > 0);
  const cogsIds = new Set(cogs.map(r => r.categoryId));
  const payrollIds = new Set(["bkc_wages", "bkc_payroll_tax", "bkc_benefits"]);
  const contractorIds = new Set(["bkc_contractor"]);
  const payrollItems = catRows.filter(r => payrollIds.has(r.categoryId) && r.total > 0);
  const contractorItems = catRows.filter(r => contractorIds.has(r.categoryId) && r.total > 0);
  const opex = catRows.filter(r => r.type === "expense" && r.total > 0 && !cogsIds.has(r.categoryId) && !payrollIds.has(r.categoryId) && !contractorIds.has(r.categoryId) && r.parent !== "bkc_cogs");

  const totalIncome = income.reduce((s, r) => s + r.total, 0) + invoiceRevenue;
  const totalCogs = cogs.reduce((s, r) => s + r.total, 0);
  const grossProfit = totalIncome - totalCogs;
  const totalOpex = opex.reduce((s, r) => s + r.total, 0);
  const totalPayroll = payrollItems.reduce((s, r) => s + r.total, 0);
  const totalContractor = contractorItems.reduce((s, r) => s + r.total, 0);
  const netIncome = grossProfit - totalOpex - totalPayroll - totalContractor;

  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const periodLabel = range.label;

  const Section = ({ title, items, total, totalLabel }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{title}</div>
      {items.map(r => <div key={r.categoryId} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 4px 16px", fontSize: 13 }}>
        <span style={{ color: theme.text }}>{r.categoryName}</span>
        <span>{fmt(r.total)}</span>
      </div>)}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${theme.borderLight}`, marginTop: 4, fontWeight: 600, fontSize: 13 }}>
        <span>{totalLabel || `Total ${title}`}</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  );

  const handleExportCSV = () => {
    const rows = [
      ...(invoiceRevenue > 0 ? [{ Section: "Income", Category: `Client Payments (${invoiceCount} paid invoices)`, Amount: invoiceRevenue }] : []),
      ...income.map(r => ({ Section: "Income", Category: r.categoryName, Amount: r.total })),
      { Section: "Income", Category: "TOTAL INCOME", Amount: totalIncome },
      ...cogs.map(r => ({ Section: "COGS", Category: r.categoryName, Amount: r.total })),
      { Section: "COGS", Category: "TOTAL COGS", Amount: totalCogs },
      { Section: "", Category: "GROSS PROFIT", Amount: grossProfit },
      ...opex.map(r => ({ Section: "Operating Expenses", Category: r.categoryName, Amount: r.total })),
      { Section: "Operating Expenses", Category: "TOTAL OPERATING", Amount: totalOpex },
      ...payrollItems.map(r => ({ Section: "Payroll", Category: r.categoryName, Amount: r.total })),
      { Section: "Payroll", Category: "TOTAL PAYROLL", Amount: totalPayroll },
      ...contractorItems.map(r => ({ Section: "Contractors", Category: r.categoryName, Amount: r.total })),
      { Section: "Contractors", Category: "TOTAL CONTRACTORS", Amount: totalContractor },
      { Section: "", Category: "NET INCOME", Amount: netIncome },
    ];
    exportCSV(rows, `pnl_${range.tag}.csv`);
    showToast("Exported P&L CSV");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const W = 210, margin = 20, cW = W - margin * 2;
    let y = 20;

    // Header — brand gold with the green wordmark
    doc.setFillColor(11, 45, 101);
    doc.rect(0, 0, W, 3, "F");
    doc.setDrawColor(237, 233, 225); doc.line(0, 36, W, 36);
    let hx = margin;
    try { const lw = 34, lh = lw / LOGO_ASPECT; doc.addImage(LOGO_PNG_DATA_URL, "PNG", margin, 19 - lh / 2, lw, lh); hx = margin + lw + 8; } catch (_) {}
    doc.setTextColor(11, 45, 101);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("Profit & Loss Statement", hx, 17);
    doc.setTextColor(26, 26, 26);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    doc.text(periodLabel, hx, 25);

    y = 48;
    const D = [26, 26, 26], G = [107, 101, 96];

    const addSection = (title, items, total, totalLabel) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setTextColor(...G); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(title.toUpperCase(), margin, y); y += 7;
      doc.setFont("helvetica", "normal"); doc.setTextColor(...D);
      for (const item of items) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`  ${item.categoryName}`, margin, y);
        doc.text(fmt(item.total), margin + cW, y, { align: "right" });
        y += 5.5;
      }
      doc.setFont("helvetica", "bold");
      doc.setDrawColor(200, 200, 200); doc.line(margin, y, margin + cW, y); y += 5;
      doc.text(totalLabel || `Total ${title}`, margin, y);
      doc.text(fmt(total), margin + cW, y, { align: "right" });
      y += 10;
      doc.setFont("helvetica", "normal");
    };

    addSection("Income", [
      ...(invoiceRevenue > 0 ? [{ categoryName: `Client Payments (${invoiceCount} paid invoices)`, total: invoiceRevenue }] : []),
      ...income,
    ], totalIncome);
    if (cogs.length > 0) addSection("Cost of Goods Sold", cogs, totalCogs);

    // Gross Profit
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...D);
    doc.text("GROSS PROFIT", margin, y);
    doc.text(fmt(grossProfit), margin + cW, y, { align: "right" });
    y += 12; doc.setFontSize(9);

    if (opex.length > 0) addSection("Operating Expenses", opex, totalOpex);
    if (payrollItems.length > 0) addSection("Payroll Expenses", payrollItems, totalPayroll);
    if (contractorItems.length > 0) addSection("Contractor Payments", contractorItems, totalContractor);

    // Net Income
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.setDrawColor(71, 108, 46); doc.setLineWidth(0.5);
    doc.line(margin, y, margin + cW, y); y += 8;
    doc.setTextColor(71, 108, 46);
    doc.text("NET INCOME", margin, y);
    doc.text(fmt(netIncome), margin + cW, y, { align: "right" });

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `PnL_${range.tag}.pdf`; a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded P&L PDF");
  };

  const expenseCategories = (data?.categories || []).filter(c => c.type === "expense");

  return <div>
    {/* Quick-add expense */}
    <div style={{ background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius, marginBottom: 16, overflow: "hidden" }}>
      <button onClick={() => setExpenseOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: theme.text }}>
          {BkIcons.plus} Add Expense
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expenseOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {expenseOpen && <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${theme.borderLight}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 130px", gap: 10, marginTop: 12, alignItems: "end" }}>
          <Input label="Date" type="date" value={expenseForm.date} onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))} />
          <Input label="Description" value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this expense?" />
          <Input label="Amount" type="number" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginTop: 10, alignItems: "end" }}>
          <Select label="Category" value={expenseForm.categoryId} onChange={e => setExpenseForm(f => ({ ...f, categoryId: e.target.value }))}>
            <option value="">Uncategorized</option>
            {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Account (optional)" value={expenseForm.accountId} onChange={e => setExpenseForm(f => ({ ...f, accountId: e.target.value }))}>
            <option value="">No account</option>
            {(data?.accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Btn onClick={handleAddExpense} disabled={saving} style={{ marginBottom: 1 }}>{saving ? "Saving…" : "Add"}</Btn>
        </div>
      </div>}
    </div>

    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
      <Btn size="sm" variant="secondary" icon={BkIcons.download} onClick={handleExportCSV}>CSV</Btn>
      <Btn size="sm" variant="secondary" icon={BkIcons.download} onClick={handleExportPDF}>PDF</Btn>
    </div>

    <div style={{ background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius, padding: "32px 40px", fontFamily: "'DM Sans', sans-serif" }}>
      {/* QBO-style header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: theme.text, fontFamily: "'Fraunces', serif" }}>{companyName || "My Company"}</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: theme.text, marginTop: 4 }}>Profit and Loss</div>
        <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>{periodLabel}</div>
      </div>

      {/* TOTAL column header */}
      <div style={{ display: "flex", justifyContent: "flex-end", borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, padding: "4px 0", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: theme.text, minWidth: 130, textAlign: "right", letterSpacing: "0.05em" }}>TOTAL</span>
      </div>

      {(() => {
        const qboRow = (label, amount, level = 1, bold = false) => {
          const indent = level * 16;
          return (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "2px 0", paddingLeft: indent }}>
              <span style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: theme.text }}>{label}</span>
              {amount !== null && <span style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: theme.text, minWidth: 130, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{bold ? fmt(amount) : amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
            </div>
          );
        };

        const qboHeader = (label) => (
          <div style={{ fontSize: 13, fontWeight: 400, color: theme.text, paddingTop: 8, paddingBottom: 2 }}>{label}</div>
        );

        const qboTotal = (label, amount, level = 0, topBorder = true) => (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3px 0", paddingLeft: level * 16, borderTop: topBorder ? `1px solid ${theme.border}` : "none", marginTop: topBorder ? 2 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.text, minWidth: 130, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(amount)}</span>
          </div>
        );

        const allIncomeItems = [
          ...(invoiceRevenue > 0 ? [{ categoryName: `Client Payments (${invoiceCount} paid invoice${invoiceCount !== 1 ? "s" : ""})`, total: invoiceRevenue }] : []),
          ...income,
        ];
        const totalAllExpenses = totalOpex + totalPayroll + totalContractor;

        return <>
          {/* INCOME */}
          {qboHeader("Income")}
          {allIncomeItems.map((r, i) => qboRow(r.categoryName, r.total, 2))}
          {qboTotal("Total Income", totalIncome, 1)}

          {/* COGS */}
          {cogs.length > 0 && <>
            {qboHeader("Cost of Goods Sold")}
            {cogs.map(r => qboRow(r.categoryName, r.total, 2))}
            {qboTotal("Total Cost of Goods Sold", totalCogs, 1)}
          </>}

          {/* GROSS PROFIT */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderTop: `1px solid ${theme.border}`, marginTop: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Gross Profit</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.text, minWidth: 130, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(grossProfit)}</span>
          </div>

          {/* EXPENSES */}
          {opex.length > 0 && <>
            {qboHeader("Operating Expenses")}
            {opex.map(r => qboRow(r.categoryName, r.total, 2))}
            {qboTotal("Total Operating Expenses", totalOpex, 1)}
          </>}

          {payrollItems.length > 0 && <>
            {qboHeader("Payroll")}
            {payrollItems.map(r => qboRow(r.categoryName, r.total, 2))}
            {qboTotal("Total Payroll", totalPayroll, 1)}
          </>}

          {contractorItems.length > 0 && <>
            {qboHeader("Contractor Payments")}
            {contractorItems.map(r => qboRow(r.categoryName, r.total, 2))}
            {qboTotal("Total Contractor Payments", totalContractor, 1)}
          </>}

          {/* NET INCOME */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderTop: `2px solid ${theme.text}`, borderBottom: `1px solid ${theme.text}`, marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Net Income</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.text, minWidth: 130, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(netIncome)}</span>
          </div>
        </>;
      })()}
    </div>
  </div>;
}

// ═══════════════════════════════════════
// BALANCE SHEET
// ═══════════════════════════════════════
function BalanceSheetView({ filterYear, range, showToast, data, act, companyName }) {
  const [bsData, setBsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [investOpen, setInvestOpen] = useState(false);
  const [investForm, setInvestForm] = useState({ date: today(), description: "", amount: "", accountId: "" });
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();
  const asOf = range.asOf; // end of the selected period (never later than today)

  const fetchBs = () => {
    setLoading(true);
    bkFetch({ report: "balance_sheet", asof: asOf })
      .then(d => setBsData(d.balanceSheet))
      .catch(e => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBs(); }, [asOf]);

  const handleAddInvestment = async () => {
    if (!investForm.date || !investForm.amount || !investForm.description) {
      showToast("Date, description, and amount are required", "error");
      return;
    }
    setSaving(true);
    const ok = await act("upsert_transaction", {
      id: genId(),
      date: investForm.date,
      name: investForm.description,
      description: investForm.description,
      amount: Math.abs(parseFloat(investForm.amount)),
      categoryId: "bkc_owner_contrib",
      accountId: investForm.accountId || null,
      type: "equity",
      vendor: "", reference: "", notes: "",
      reconciled: false, reviewed: false, source: "manual",
    });
    setSaving(false);
    if (ok) {
      showToast("Investment recorded");
      setInvestForm({ date: today(), description: "", amount: "", accountId: "" });
      setInvestOpen(false);
      fetchBs();
    }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Loading...</div>;
  if (!bsData) return <Empty message="No balance sheet data available." />;

  const { accountBalances, unassignedBalance, invoiceRevenue = 0, otherIncome = 0, totalExpenses = 0, ownerInvestments = 0, ownerContributions = 0, ownerDraws = 0, retainedEarnings } = bsData;

  const totalCash = accountBalances.reduce((s, a) => s + a.balance, 0) + unassignedBalance;
  const totalAssets = totalCash; // cash basis: unpaid invoices are not assets
  const totalLiabilities = 0;
  const totalEquity = retainedEarnings + ownerInvestments;

  const asOfLabel = new Date(asOf + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const BSSection = ({ title, children, total, totalLabel, color }) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{title}</div>
      {children}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${theme.borderLight}`, marginTop: 4, fontWeight: 600, fontSize: 13 }}>
        <span>{totalLabel || `Total ${title}`}</span>
        <span style={{ color: color || theme.text }}>{fmt(total)}</span>
      </div>
    </div>
  );

  const BSRow = ({ label, value, indent = true, muted }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 4px " + (indent ? "16px" : "0"), fontSize: 13 }}>
      <span style={{ color: muted ? theme.textMuted : theme.text }}>{label}</span>
      <span>{fmt(value)}</span>
    </div>
  );

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const W = 210, margin = 20, cW = W - margin * 2;
    let y = 20;

    doc.setFillColor(11, 45, 101);
    doc.rect(0, 0, W, 3, "F");
    doc.setDrawColor(237, 233, 225); doc.line(0, 36, W, 36);
    let hx = margin;
    try { const lw = 34, lh = lw / LOGO_ASPECT; doc.addImage(LOGO_PNG_DATA_URL, "PNG", margin, 19 - lh / 2, lw, lh); hx = margin + lw + 8; } catch (_) {}
    doc.setTextColor(11, 45, 101);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("Balance Sheet", hx, 17);
    doc.setTextColor(26, 26, 26);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    doc.text(`As of ${asOfLabel} · Cash basis`, hx, 25);

    y = 48;
    const D = [26, 26, 26], G = [107, 101, 96];

    const pdfSection = (title) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setTextColor(...G); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(title.toUpperCase(), margin, y); y += 7;
      doc.setFont("helvetica", "normal"); doc.setTextColor(...D);
    };

    const pdfRow = (label, value, bold = false) => {
      if (y > 270) { doc.addPage(); y = 20; }
      if (bold) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", "normal");
      doc.text(`  ${label}`, margin, y);
      doc.text(fmt(value), margin + cW, y, { align: "right" });
      y += 5.5;
    };

    const pdfTotal = (label, value) => {
      doc.setFont("helvetica", "bold");
      doc.setDrawColor(200, 200, 200); doc.line(margin, y, margin + cW, y); y += 5;
      doc.text(label, margin, y);
      doc.text(fmt(value), margin + cW, y, { align: "right" });
      y += 10;
    };

    // Assets
    pdfSection("Assets");
    if (accountBalances.length > 0) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8.5);
      doc.text("  Bank Accounts", margin, y); y += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      accountBalances.forEach(a => pdfRow(a.name, a.balance));
    }
    if (unassignedBalance !== 0) pdfRow("Unassigned Transactions", unassignedBalance);
    pdfTotal("Total Assets", totalAssets);

    // Liabilities
    pdfSection("Liabilities");
    pdfRow("(No liabilities tracked)", 0, false);
    pdfTotal("Total Liabilities", 0);

    // Equity
    pdfSection("Equity");
    if (ownerContributions > 0) pdfRow("Owner's Contributions", ownerContributions);
    if (ownerDraws > 0) pdfRow("Owner's Draws", -ownerDraws);
    pdfRow("Retained Earnings (Net Income)", retainedEarnings);
    pdfTotal("Total Equity", totalEquity);

    // Grand total
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.setDrawColor(71, 108, 46); doc.setLineWidth(0.5);
    doc.line(margin, y, margin + cW, y); y += 8;
    doc.setTextColor(71, 108, 46);
    doc.text("Total Liabilities + Equity", margin, y);
    doc.text(fmt(totalLiabilities + totalEquity), margin + cW, y, { align: "right" });

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `BalanceSheet_${range.tag}.pdf`; a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded Balance Sheet PDF");
  };

  const handleExportCSV = () => {
    const rows = [
      { Section: "Assets", Item: "Bank Accounts", Amount: "" },
      ...accountBalances.map(a => ({ Section: "Assets", Item: a.name, Amount: a.balance })),
      ...(unassignedBalance !== 0 ? [{ Section: "Assets", Item: "Unassigned Transactions", Amount: unassignedBalance }] : []),
      { Section: "Assets", Item: "TOTAL ASSETS", Amount: totalAssets },
      { Section: "Liabilities", Item: "TOTAL LIABILITIES", Amount: 0 },
      { Section: "Equity", Item: "Owner's Contributions", Amount: ownerContributions },
      { Section: "Equity", Item: "Owner's Draws", Amount: -ownerDraws },
      { Section: "Equity", Item: "Retained Earnings (Net Income)", Amount: retainedEarnings },
      { Section: "Equity", Item: "TOTAL EQUITY", Amount: totalEquity },
      { Section: "", Item: "TOTAL LIABILITIES + EQUITY", Amount: totalLiabilities + totalEquity },
    ];
    exportCSV(rows, `balance_sheet_${range.tag}.csv`);
    showToast("Exported Balance Sheet CSV");
  };

  const qboRow = (label, amount, level = 1, bold = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "2px 0", paddingLeft: level * 16 }}>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: theme.text }}>{label}</span>
      {amount !== null && <span style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: theme.text, minWidth: 130, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{bold ? fmt(amount) : amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
    </div>
  );

  const qboTotal = (label, amount, level = 0) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3px 0", paddingLeft: level * 16, borderTop: `1px solid ${theme.border}`, marginTop: 2 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: theme.text, minWidth: 130, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(amount)}</span>
    </div>
  );

  return <div>
    {/* Quick-add investment */}
    <div style={{ background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius, marginBottom: 16, overflow: "hidden" }}>
      <button onClick={() => setInvestOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: theme.text }}>
          {BkIcons.plus} Record Principal Investment
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: investOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {investOpen && <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${theme.borderLight}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 130px", gap: 10, marginTop: 12, alignItems: "end" }}>
          <Input label="Date" type="date" value={investForm.date} onChange={e => setInvestForm(f => ({ ...f, date: e.target.value }))} />
          <Input label="Description" value={investForm.description} onChange={e => setInvestForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Owner capital contribution" />
          <Input label="Amount" type="number" value={investForm.amount} onChange={e => setInvestForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 10, alignItems: "end" }}>
          <Select label="Account (optional)" value={investForm.accountId} onChange={e => setInvestForm(f => ({ ...f, accountId: e.target.value }))}>
            <option value="">No account</option>
            {(data?.accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Btn onClick={handleAddInvestment} disabled={saving} style={{ marginBottom: 1 }}>{saving ? "Saving…" : "Record"}</Btn>
        </div>
      </div>}
    </div>

    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
      <Btn size="sm" variant="secondary" icon={BkIcons.download} onClick={handleExportCSV}>CSV</Btn>
      <Btn size="sm" variant="secondary" icon={BkIcons.download} onClick={handleExportPDF}>PDF</Btn>
    </div>

    <div style={{ background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius, padding: "32px 40px", fontFamily: "'DM Sans', sans-serif" }}>

      {/* QBO-style header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: theme.text, fontFamily: "'Fraunces', serif" }}>{companyName || "My Company"}</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: theme.text, marginTop: 4 }}>Balance Sheet</div>
        <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>As of {asOfLabel} · Cash basis</div>
      </div>

      {/* TOTAL column header */}
      <div style={{ display: "flex", justifyContent: "flex-end", borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, padding: "4px 0", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: theme.text, minWidth: 130, textAlign: "right", letterSpacing: "0.05em" }}>TOTAL</span>
      </div>

      {/* ASSETS */}
      {qboRow("Assets", null, 0)}
      {qboRow("Current Assets", null, 1)}
      {accountBalances.length > 0 && <>
        {qboRow("Bank Accounts", null, 2)}
        {accountBalances.map(a => qboRow(a.name, a.balance, 3))}
        {qboTotal("Total for Bank Accounts", accountBalances.reduce((s, a) => s + a.balance, 0), 2)}
      </>}
      {unassignedBalance !== 0 && qboRow(accountBalances.length ? "Cash — not yet assigned to a bank account" : "Cash & bank (ledger)", unassignedBalance, 3)}
      {qboTotal("Total for Current Assets", totalAssets, 1)}
      {qboTotal("Total for Assets", totalAssets, 0)}

      <div style={{ borderTop: `1px solid ${theme.border}`, margin: "8px 0" }} />

      {/* LIABILITIES AND EQUITY */}
      {qboRow("Liabilities and Equity", null, 0)}
      {qboRow("Liabilities", null, 1)}
      {qboRow("(No liabilities tracked)", null, 2)}
      {qboTotal("Total for Liabilities", 0, 1)}

      {/* EQUITY */}
      {qboRow("Equity", null, 1)}
      {ownerContributions > 0 && qboRow("Owner's Contributions", ownerContributions, 2)}
      {ownerDraws > 0 && qboRow("Owner's Draws", -ownerDraws, 2)}
      {qboRow("Net Income (retained earnings to date)", retainedEarnings, 2)}
      {qboTotal("Total for Equity", totalEquity, 1)}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderTop: `2px solid ${theme.text}`, borderBottom: `2px solid ${theme.text}`, marginTop: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Total for Liabilities and Equity</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: theme.text, minWidth: 130, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(totalLiabilities + totalEquity)}</span>
      </div>
    </div>
  </div>;
}

// ═══════════════════════════════════════
// CHART OF ACCOUNTS — categories (income / expense / equity) + bank & cash accounts
// ═══════════════════════════════════════
const CORE_CATEGORY_IDS = new Set(["bkc_revenue", "bkc_cogs", "bkc_owner_contrib", "bkc_owner_draws"]);
const CATEGORY_TYPES = [["income", "Income"], ["expense", "Expense"], ["equity", "Owner equity"]];
const ACCOUNT_TYPES = [["checking", "Checking"], ["savings", "Savings"], ["credit_card", "Credit card"], ["cash", "Cash"], ["other", "Other"]];

function ChartOfAccountsView({ data, act, showToast, canEdit }) {
  const [catModal, setCatModal] = useState(null);   // null | "new" | category
  const [acctModal, setAcctModal] = useState(null); // null | "new" | account
  const categories = data.categories || [];
  const accounts = data.accounts || [];
  const usage = {};
  for (const t of data.transactions || []) { if (t.categoryId) usage[t.categoryId] = (usage[t.categoryId] || 0) + 1; }
  const acctUsage = {};
  for (const t of data.transactions || []) { if (t.accountId) acctUsage[t.accountId] = (acctUsage[t.accountId] || 0) + 1; }

  const saveCategory = async (c) => {
    const ok = await act("upsert_category", { ...c, id: c.id || ("bkc_" + genId()), sortOrder: c.sortOrder ?? (categories.length + 100) });
    if (ok) { showToast(c.id ? "Category updated" : "Category added"); setCatModal(null); }
  };
  const removeCategory = async (c) => {
    const n = usage[c.id] || 0;
    if (!confirm(`Delete "${c.name}"?${n ? ` ${n} transaction${n === 1 ? "" : "s"} will become uncategorized.` : ""}`)) return;
    if (await act("delete_category", { id: c.id })) showToast("Category deleted");
  };
  const saveAccount = async (a) => {
    const ok = await act("upsert_account", { ...a, id: a.id || ("acct_" + genId()) });
    if (ok) { showToast(a.id ? "Account updated" : "Account added"); setAcctModal(null); }
  };
  const removeAccount = async (a) => {
    const n = acctUsage[a.id] || 0;
    if (!confirm(`Delete "${a.name}"?${n ? ` ${n} transaction${n === 1 ? "" : "s"} will be left with no account.` : ""}`)) return;
    if (await act("delete_account", { id: a.id })) showToast("Account deleted");
  };

  const section = (type, label) => {
    const rows = categories.filter(c => c.type === type).sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
    const parents = rows.filter(c => !c.parent);
    const children = (pid) => rows.filter(c => c.parent === pid);
    const row = (c, depth) => <tr key={c.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
      <td style={{ padding: "9px 14px", fontSize: 13, paddingLeft: 14 + depth * 22, fontWeight: depth ? 400 : 500 }}>{depth > 0 && <span style={{ color: theme.textMuted, marginRight: 6 }}>└</span>}{c.name}{CORE_CATEGORY_IDS.has(c.id) && <span style={{ marginLeft: 8, fontSize: 10, color: theme.textMuted, fontWeight: 600, letterSpacing: "0.05em" }}>CORE</span>}</td>
      <td style={{ padding: "9px 14px", fontSize: 12, color: theme.textMuted, textAlign: "right", whiteSpace: "nowrap" }}>{usage[c.id] ? `${usage[c.id]} txn${usage[c.id] === 1 ? "" : "s"}` : "—"}</td>
      <td style={{ padding: "9px 14px", textAlign: "right", whiteSpace: "nowrap" }}>{canEdit && <>
        <Btn size="sm" variant="ghost" icon={BkIcons.edit} onClick={() => setCatModal(c)} title="Edit" />
        {!CORE_CATEGORY_IDS.has(c.id) && <Btn size="sm" variant="ghost" icon={BkIcons.trash} style={{ color: theme.danger }} onClick={() => removeCategory(c)} title="Delete" />}
      </>}</td>
    </tr>;
    return <div key={type} style={{ marginBottom: 20 }}>
      <div style={{ padding: "12px 14px", background: theme.surfaceAlt, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: theme.textSecondary, display: "flex", justifyContent: "space-between", alignItems: "center" }}>{label}<span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>{rows.length} account{rows.length === 1 ? "" : "s"}</span></div>
      {rows.length === 0 ? <div style={{ padding: "14px", fontSize: 13, color: theme.textMuted }}>None yet.</div> :
        <table style={{ width: "100%" }}><tbody>{parents.map(p => [row(p, 0), ...children(p.id).map(c => row(c, 1))])}</tbody></table>}
    </div>;
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
      <div style={{ fontSize: 13, color: theme.textSecondary, maxWidth: 560 }}>Income and expense categories drive the P&L. <b>Owner equity</b> (contributions and draws) moves money without touching profit and shows on the Balance Sheet. Bank &amp; cash accounts are what you reconcile against.</div>
      {canEdit && <div style={{ display: "flex", gap: 8 }}><Btn size="sm" variant="secondary" icon={BkIcons.plus} onClick={() => setAcctModal("new")}>Bank Account</Btn><Btn size="sm" icon={BkIcons.plus} onClick={() => setCatModal("new")}>Category</Btn></div>}
    </div>

    <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, overflow: "hidden", marginBottom: 20 }}>
      {CATEGORY_TYPES.map(([type, label]) => section(type, label))}
    </div>

    <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", background: theme.surfaceAlt, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: theme.textSecondary }}>Bank &amp; cash accounts</div>
      {accounts.length === 0 ? <div style={{ padding: "14px", fontSize: 13, color: theme.textMuted }}>No accounts yet — add your checking account so imports and the Balance Sheet have somewhere to land.</div> :
        <table style={{ width: "100%" }}><tbody>{accounts.map(a => <tr key={a.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
          <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 500 }}>{a.name}</td>
          <td style={{ padding: "9px 14px", fontSize: 12, color: theme.textSecondary }}>{(ACCOUNT_TYPES.find(t => t[0] === a.accountType) || [])[1] || a.accountType}</td>
          <td style={{ padding: "9px 14px", fontSize: 12, color: theme.textMuted, textAlign: "right", whiteSpace: "nowrap" }}>{acctUsage[a.id] ? `${acctUsage[a.id]} txns` : "—"}</td>
          <td style={{ padding: "9px 14px", textAlign: "right", whiteSpace: "nowrap" }}>{canEdit && <><Btn size="sm" variant="ghost" icon={BkIcons.edit} onClick={() => setAcctModal(a)} title="Edit" /><Btn size="sm" variant="ghost" icon={BkIcons.trash} style={{ color: theme.danger }} onClick={() => removeAccount(a)} title="Delete" /></>}</td>
        </tr>)}</tbody></table>}
    </div>

    <Modal open={!!catModal} onClose={() => setCatModal(null)} title={catModal === "new" ? "New Category" : "Edit Category"}>
      {catModal && <CategoryForm item={catModal === "new" ? null : catModal} categories={categories} onSave={saveCategory} onCancel={() => setCatModal(null)} />}
    </Modal>
    <Modal open={!!acctModal} onClose={() => setAcctModal(null)} title={acctModal === "new" ? "New Bank Account" : "Edit Bank Account"}>
      {acctModal && <AccountForm item={acctModal === "new" ? null : acctModal} onSave={saveAccount} onCancel={() => setAcctModal(null)} />}
    </Modal>
  </div>;
}

function CategoryForm({ item, categories, onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", type: "expense", parent: "", ...(item || {}) });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const parents = categories.filter(c => c.type === form.type && !c.parent && c.id !== form.id);
  const isCore = item && CORE_CATEGORY_IDS.has(item.id);
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Input label="Name *" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Software & Subscriptions" />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Select label="Type *" value={form.type} onChange={e => { set("type", e.target.value); set("parent", ""); }} disabled={isCore}>
        {CATEGORY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
      <Select label="Sub-account of" value={form.parent || ""} onChange={e => set("parent", e.target.value)}>
        <option value="">— None (top level) —</option>
        {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
    </div>
    {isCore && <div style={{ fontSize: 12, color: theme.textMuted }}>This is a core account the reports depend on — you can rename it, but not change its type or delete it.</div>}
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
      <Btn onClick={() => form.name.trim() && onSave({ ...form, name: form.name.trim(), parent: form.parent || null })}>Save</Btn>
    </div>
  </div>;
}

function AccountForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", accountType: "checking", ...(item || {}) });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Input label="Name *" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Chase Business Checking ••1234" />
    <Select label="Type" value={form.accountType} onChange={e => set("accountType", e.target.value)}>
      {ACCOUNT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </Select>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
      <Btn onClick={() => form.name.trim() && onSave({ ...form, name: form.name.trim() })}>Save</Btn>
    </div>
  </div>;
}
