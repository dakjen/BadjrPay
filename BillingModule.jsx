"use client";
import { useState, useEffect, useRef } from "react";
import { readHash, writeHash } from "./lib/hash-state";

// ═══════════════════════════════════════
// BILLING MODULE — Stripe recurring plans + live revenue dashboard
// ═══════════════════════════════════════

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
  shadowLg: "0 10px 30px rgba(0,0,0,0.1)",
  radius: "10px", radiusSm: "6px", radiusLg: "14px",
};
const sans = "'DM Sans', sans-serif";
const serif = "'Fraunces', serif";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const fmtCompact = (n) => Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;
const fmtDate = (d) => { if (!d) return "—"; try { const s = String(d).trim(); const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date(s).toISOString().split("T")[0]; const [y, m, day] = iso.split("-"); return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return "—"; } };
const INTERVALS = [
  { id: "month:1", label: "Monthly", interval: "month", count: 1 },
  { id: "month:3", label: "Quarterly", interval: "month", count: 3 },
  { id: "month:6", label: "Every 6 months", interval: "month", count: 6 },
  { id: "year:1", label: "Yearly", interval: "year", count: 1 },
  { id: "week:1", label: "Weekly", interval: "week", count: 1 },
];
const intervalLabel = (interval, count = 1) => (INTERVALS.find(i => i.interval === interval && i.count === count) || {}).label || `Every ${count} ${interval}s`;

// ── Shared primitives (module-local, same look as the rest of the app) ──
function Btn({ children, onClick, variant = "primary", size = "md", icon, style: sx, disabled, ...props }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: sans, fontWeight: 500, borderRadius: theme.radiusSm, transition: "all 0.15s ease", whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1 };
  const sizes = { sm: { padding: "6px 12px", fontSize: 12 }, md: { padding: "8px 16px", fontSize: 13 }, lg: { padding: "10px 20px", fontSize: 14 } };
  const variants = { primary: { background: theme.accent, color: "#fff" }, secondary: { background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}` }, ghost: { background: "transparent", color: theme.textSecondary }, danger: { background: theme.dangerLight, color: theme.danger }, success: { background: theme.successLight, color: theme.success }, blue: { background: theme.blueLight, color: theme.blue } };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...sx }} {...props}>{icon}{children}</button>;
}
function Input({ label, hint, ...props }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{label && <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, fontFamily: sans }}>{label}</label>}<input {...props} style={{ padding: "8px 12px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: sans, outline: "none", background: theme.surface, color: theme.text, ...props.style }} />{hint && <div style={{ fontSize: 11, color: theme.textMuted }}>{hint}</div>}</div>;
}
function Select({ label, children, ...props }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{label && <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, fontFamily: sans }}>{label}</label>}<select {...props} style={{ padding: "8px 12px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: sans, outline: "none", background: theme.surface, color: theme.text, cursor: "pointer", ...props.style }}>{children}</select></div>;
}
function Textarea({ label, ...props }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{label && <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, fontFamily: sans }}>{label}</label>}<textarea {...props} style={{ padding: "8px 12px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: sans, outline: "none", background: theme.surface, color: theme.text, resize: "vertical", minHeight: 60, ...props.style }} /></div>;
}
function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  return <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} onClick={onClose}><div onClick={e => e.stopPropagation()} style={{ background: theme.surface, borderRadius: `${theme.radiusLg} ${theme.radiusLg} 0 0`, width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto", boxShadow: theme.shadowLg, animation: "modalIn 0.2s ease" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${theme.borderLight}` }}><h3 style={{ margin: 0, fontSize: 16, fontFamily: serif, fontWeight: 600, color: theme.text }}>{title}</h3><button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, padding: 4, fontSize: 18, lineHeight: 1 }}>×</button></div><div style={{ padding: "20px" }}>{children}</div></div></div>;
}
function StatCard({ label, value, sub, icon, color = theme.accent }) {
  return <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px 20px", border: `1px solid ${theme.borderLight}`, flex: "1 1 180px", minWidth: 160 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500, marginBottom: 6, fontFamily: sans, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div><div style={{ fontSize: 22, fontWeight: 700, color: theme.text, fontFamily: serif }}>{value}</div>{sub && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{sub}</div>}</div><div style={{ color, opacity: 0.6 }}>{icon}</div></div></div>;
}
function Card({ title, action, children, style }) {
  return <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, overflow: "hidden", ...style }}>
    {title && <div style={{ padding: "14px 18px", borderBottom: `1px solid ${theme.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 600, fontSize: 14, fontFamily: serif }}>{title}</span>{action}</div>}
    {children}
  </div>;
}
function Empty({ message, action }) {
  return <div style={{ textAlign: "center", padding: "40px 20px", color: theme.textMuted, fontSize: 14, fontFamily: sans }}>{message}{action && <div style={{ marginTop: 14 }}>{action}</div>}</div>;
}
function Banner({ tone = "info", children, action }) {
  const tones = { info: { bg: theme.blueLight, color: theme.blue }, warning: { bg: theme.warningLight, color: theme.warning }, danger: { bg: theme.dangerLight, color: theme.danger }, success: { bg: theme.successLight, color: theme.success } };
  const t = tones[tone];
  return <div style={{ background: t.bg, color: t.color, borderRadius: theme.radiusSm, padding: "10px 14px", fontSize: 13, fontWeight: 500, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><span>{children}</span>{action}</div>;
}
const th = { padding: "10px 14px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.textMuted, fontWeight: 600, whiteSpace: "nowrap" };
const td = { padding: "10px 14px", fontSize: 13, verticalAlign: "middle" };
const money = { ...td, fontWeight: 600, fontFamily: serif, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };

const SUB_STATUS = {
  pending: { bg: theme.blueLight, color: theme.blue, label: "Awaiting setup" },
  active: { bg: theme.successLight, color: theme.success, label: "Active" },
  trialing: { bg: theme.blueLight, color: theme.blue, label: "Trial" },
  past_due: { bg: theme.dangerLight, color: theme.danger, label: "Past due" },
  unpaid: { bg: theme.dangerLight, color: theme.danger, label: "Unpaid" },
  paused: { bg: theme.surfaceAlt, color: theme.textSecondary, label: "Paused" },
  canceled: { bg: theme.surfaceAlt, color: theme.textMuted, label: "Canceled" },
  incomplete: { bg: theme.warningLight, color: theme.warning, label: "Incomplete" },
  incomplete_expired: { bg: theme.surfaceAlt, color: theme.textMuted, label: "Expired" },
};
function SubStatus({ status, cancelAtPeriodEnd }) {
  const s = SUB_STATUS[status] || SUB_STATUS.pending;
  const label = cancelAtPeriodEnd && ["active", "trialing"].includes(status) ? "Ending" : s.label;
  const color = cancelAtPeriodEnd && ["active", "trialing"].includes(status) ? theme.warning : s.color;
  const bg = cancelAtPeriodEnd && ["active", "trialing"].includes(status) ? theme.warningLight : s.bg;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: bg, color, letterSpacing: "0.02em", fontFamily: sans, whiteSpace: "nowrap" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: color, opacity: 0.7 }} />{label}</span>;
}

const Ic = {
  dollar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  repeat: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  bank: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h18M5 10v9M9 10v9M15 10v9M19 10v9M2 19h20M12 3l10 7H2z"/></svg>,
  users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  refresh: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  mail: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  link: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  x: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  trash: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  external: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  spinner: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
};
const Spin = () => <span className="spin" style={{ display: "inline-flex" }}>{Ic.spinner}</span>;

// ── API ──
async function billingGet(view) {
  const r = await fetch(`/api/billing?view=${view}`, { cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body;
}
async function billingPost(action, data) {
  const r = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body;
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { window.prompt("Copy this link:", text); return false; }
}

// ═══════════════════════════════════════
// SHELL
// ═══════════════════════════════════════
export function BillingShell({ session, showToast, clients = [] }) {
  const [tab, setTab] = useState(readHash().sub === "plans" ? "subscriptions" : "revenue");
  useEffect(() => { writeHash("billing", tab === "subscriptions" ? "plans" : ""); }, [tab]);
  const [rev, setRev] = useState(null);
  const [revLoading, setRevLoading] = useState(true);
  const [revError, setRevError] = useState(null);
  const [subs, setSubs] = useState(null);
  const [subsLoading, setSubsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [modal, setModal] = useState(null); // "new" | { link }

  const role = session?.user?.role || "owner";
  const canEdit = role !== "accountant";

  const loadRevenue = async () => {
    setRevLoading(true); setRevError(null);
    try { setRev(await billingGet("revenue")); } catch (e) { setRevError(e.message); } finally { setRevLoading(false); }
  };
  const loadSubs = async () => {
    setSubsLoading(true);
    try { setSubs(await billingGet("subscriptions")); } catch (e) { showToast(e.message, "error"); } finally { setSubsLoading(false); }
  };
  useEffect(() => { loadRevenue(); loadSubs(); }, []);

  const act = async (action, data, successMsg) => {
    try {
      const res = await billingPost(action, data);
      if (successMsg) showToast(typeof successMsg === "function" ? successMsg(res) : successMsg);
      await loadSubs();
      return res;
    } catch (e) { showToast(e.message, "error"); return null; }
  };

  const sync = async () => {
    setSyncing(true);
    const res = await act("sync", {}, r => `Synced with Stripe — ${r.updated} updated, ${r.adopted} imported, ${r.payments} new payments`);
    if (res) loadRevenue();
    setSyncing(false);
  };

  const configured = subs ? subs.configured : true;
  const tabs = [{ id: "revenue", label: "Revenue" }, { id: "subscriptions", label: "Recurring Plans" }];

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
      <h1 style={{ margin: 0, fontFamily: serif, fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>Billing {rev && rev.configured && !rev.livemode && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 20, background: theme.warningLight, color: theme.warning, fontFamily: sans }}>STRIPE TEST MODE</span>}</h1>
      {configured && <div style={{ display: "flex", gap: 8 }}>
        {canEdit && <Btn variant="secondary" size="sm" icon={syncing ? <Spin /> : Ic.refresh} onClick={sync} disabled={syncing}>{syncing ? "Syncing…" : "Sync from Stripe"}</Btn>}
        {canEdit && <Btn size="sm" icon={Ic.plus} onClick={() => setModal("new")}>New Plan</Btn>}
      </div>}
    </div>

    <div style={{ display: "flex", gap: 2, marginBottom: 20, overflowX: "auto", borderBottom: `1px solid ${theme.borderLight}` }}>
      {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 14px", border: "none", borderBottom: tab === t.id ? `2px solid ${theme.accent}` : "2px solid transparent", background: "transparent", color: tab === t.id ? theme.accent : theme.textSecondary, fontWeight: tab === t.id ? 600 : 400, fontSize: 13, fontFamily: sans, cursor: "pointer", whiteSpace: "nowrap" }}>{t.label}</button>)}
    </div>

    {subs && !subs.configured && <SetupCard baseUrl={subs.baseUrl} />}

    {tab === "revenue" && <RevenueView rev={rev} loading={revLoading} error={revError} reload={loadRevenue} />}
    {tab === "subscriptions" && <SubscriptionsView subs={subs} loading={subsLoading} act={act} canEdit={canEdit} showToast={showToast} onNew={() => setModal("new")} />}

    <Modal open={modal === "new"} onClose={() => setModal(null)} title="New Recurring Plan" width={560}>
      <NewPlanForm clients={clients} onCancel={() => setModal(null)} onCreated={(res) => { setModal({ link: res.payUrl, emailed: res.emailed, emailError: res.emailError, sub: res.subscription }); loadSubs(); }} />
    </Modal>
    <Modal open={!!modal?.link} onClose={() => setModal(null)} title="Plan created">
      {modal?.link && <LinkPanel link={modal.link} emailed={modal.emailed} emailError={modal.emailError} sub={modal.sub} onClose={() => setModal(null)} showToast={showToast} />}
    </Modal>
  </div>;
}

function SetupCard({ baseUrl }) {
  const webhookUrl = `${baseUrl || ""}/api/stripe/webhook`;
  const code = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, background: theme.surfaceAlt, padding: "2px 6px", borderRadius: 4 };
  return <Card title="Connect Stripe to turn this on" style={{ marginBottom: 20 }}>
    <div style={{ padding: "16px 18px", fontSize: 13, color: theme.textSecondary, lineHeight: 1.7 }}>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        <li>In Stripe → <b>Developers → API keys</b>, copy the <b>Secret key</b> and add it to Vercel as <span style={code}>STRIPE_SECRET_KEY</span>.</li>
        <li>Redeploy. Revenue and plans appear here automatically.</li>
        <li>Then open <b>Recurring Plans</b> and click <b>Set up webhook</b> — the app registers <span style={code}>{webhookUrl}</span> in Stripe for you.</li>
      </ol>
    </div>
  </Card>;
}

// ═══════════════════════════════════════
// REVENUE
// ═══════════════════════════════════════
function RevenueView({ rev, loading, error, reload }) {
  if (loading && !rev) return <Empty message="Loading revenue from Stripe…" />;
  if (error) return <Banner tone="danger" action={<Btn size="sm" variant="secondary" onClick={reload}>Retry</Btn>}>Couldn't load Stripe data: {error}</Banner>;
  if (!rev || !rev.configured) return null;
  const delta = rev.lastMonth > 0 ? ((rev.thisMonth - rev.lastMonth) / rev.lastMonth) * 100 : null;
  const refreshed = rev.generatedAt ? new Date(rev.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

  return <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
    {rev.pastDue.length > 0 && <Banner tone="danger">{rev.pastDue.length} subscription{rev.pastDue.length > 1 ? "s" : ""} past due: {rev.pastDue.map(p => p.customer).join(", ")}</Banner>}

    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
      <StatCard label="Monthly recurring" value={fmt(rev.mrr)} sub={`${rev.activeCount} active plan${rev.activeCount === 1 ? "" : "s"}${rev.trialingCount ? ` · ${rev.trialingCount} on trial` : ""}`} icon={Ic.repeat} color={theme.accent} />
      <StatCard label="This month" value={fmt(rev.thisMonth)} sub={delta == null ? "No revenue last month" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(0)}% vs last month`} icon={Ic.dollar} color={theme.success} />
      <StatCard label="Last 12 months" value={fmt(rev.trailing12)} sub={`${fmt(rev.ytd)} year to date`} icon={Ic.calendar} color={theme.blue} />
      <StatCard label="Stripe balance" value={fmt(rev.balance.available)} sub={`${fmt(rev.balance.pending)} pending payout`} icon={Ic.bank} color={theme.warning} />
    </div>

    <Card title="Revenue by month" action={<div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 11, color: theme.textMuted }}>Updated {refreshed}</span><Btn size="sm" variant="ghost" icon={loading ? <Spin /> : Ic.refresh} onClick={reload} disabled={loading} title="Refresh" /></div>} style={{ marginBottom: 20 }}>
      <MonthlyChart months={rev.months} />
    </Card>

    <div className="r-g" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <Card title="Recent payments">
        {rev.recentPayments.length === 0 ? <Empty message="No payments yet" /> :
          <div className="r-tbl"><table style={{ width: "100%" }}><thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}>{["Date", "From", "Amount"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
            {rev.recentPayments.map(p => <tr key={p.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
              <td style={{ ...td, color: theme.textSecondary, whiteSpace: "nowrap" }}>{fmtDate(p.date)}</td>
              <td style={td}><div style={{ fontWeight: 500 }}>{p.name}</div>{p.description && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{p.description}</div>}</td>
              <td style={{ ...money, textAlign: "right" }}>{fmt(p.amount)}{p.refunded > 0 && <div style={{ fontSize: 11, color: theme.danger, fontWeight: 500, fontFamily: sans }}>−{fmt(p.refunded)} refunded</div>}{p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", marginLeft: 6, color: theme.textMuted, verticalAlign: "middle" }} title="Receipt">{Ic.external}</a>}</td>
            </tr>)}
          </tbody></table></div>}
      </Card>
      <Card title="Active subscriptions in Stripe">
        {rev.subscriptions.length === 0 ? <Empty message="No active subscriptions yet" /> :
          <div className="r-tbl"><table style={{ width: "100%" }}><thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}>{["Customer", "Plan", "Next bill"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
            {rev.subscriptions.map(s => <tr key={s.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
              <td style={td}><div style={{ fontWeight: 500 }}>{s.customer}</div><div style={{ marginTop: 3 }}><SubStatus status={s.status} cancelAtPeriodEnd={s.cancelAtPeriodEnd} /></div></td>
              <td style={td}><div>{s.plan}</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{fmt(s.amount)} · {s.intervalLabel}</div></td>
              <td style={{ ...td, color: theme.textSecondary, whiteSpace: "nowrap" }}>{s.nextBilling ? fmtDate(s.nextBilling) : "—"}</td>
            </tr>)}
          </tbody></table></div>}
      </Card>
    </div>
    {(rev.failedCount > 0 || rev.refunded > 0) && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 14 }}>Last 12 months: {rev.failedCount} failed charge{rev.failedCount === 1 ? "" : "s"} · {fmt(rev.refunded)} refunded (already netted out above).</div>}
  </div>;
}

// Single-series column chart: brand hue only, hairline grid, selective labels, per-bar hover, table toggle.
function useMeasuredWidth(ref, fallback = 720) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => { const cw = entries[0]?.contentRect?.width; if (cw) setW(Math.max(280, Math.floor(cw))); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return w;
}

function MonthlyChart({ months }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const wrapRef = useRef(null);
  const W = useMeasuredWidth(wrapRef);
  const H = 260, padL = 56, padR = 16, padT = 26, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(0, ...months.map(m => m.total));
  const niceMax = (() => { if (max <= 0) return 100; const p = Math.pow(10, Math.floor(Math.log10(max))); const n = max / p; const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10; return step * p; })();
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * niceMax);
  const band = plotW / months.length;
  const barW = Math.min(24, band * 0.55);
  const y = (v) => padT + plotH - (v / niceMax) * plotH;
  const maxIdx = months.reduce((bi, m, i) => (m.total > months[bi].total ? i : bi), 0);
  const cur = months.length - 1;
  const labelled = new Set([maxIdx, cur].filter(i => months[i].total > 0));
  const allZero = max <= 0;

  return <div style={{ padding: "16px 18px 8px" }}>
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", fontFamily: sans }} role="img" aria-label="Revenue by month, last 12 months">
        {ticks.map(t => <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={theme.borderLight} strokeWidth="1" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={theme.textMuted} style={{ fontVariantNumeric: "tabular-nums" }}>{fmtCompact(t)}</text>
        </g>)}
        {months.map((m, i) => {
          const x = padL + i * band + (band - barW) / 2;
          const top = y(m.total);
          const h = Math.max(0, padT + plotH - top);
          const r = Math.min(4, h);
          const isHover = hover === i;
          const path = h > 0 ? `M${x},${padT + plotH} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z` : null;
          return <g key={m.key}>
            {path && <path d={path} fill={theme.accent} opacity={isHover ? 0.75 : 1} />}
            {labelled.has(i) && h > 0 && <text x={x + barW / 2} y={top - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill={theme.textSecondary}>{fmtCompact(m.total)}</text>}
            <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize="11" fill={i === cur ? theme.text : theme.textMuted} fontWeight={i === cur ? 600 : 400}>{m.label}</text>
            <rect x={padL + i * band} y={padT} width={band} height={plotH + padB} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} style={{ outline: "none", cursor: "default" }} />
          </g>;
        })}
        <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke={theme.border} strokeWidth="1" />
      </svg>
      {hover != null && <div style={{ position: "absolute", left: `${((padL + hover * band + band / 2) / W) * 100}%`, top: 0, transform: `translate(${hover > 8 ? "-100%" : "-50%"}, 0)`, background: theme.text, color: "#fff", borderRadius: 6, padding: "8px 10px", fontSize: 12, pointerEvents: "none", boxShadow: theme.shadowMd, whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt(months[hover].total)}</div>
        <div style={{ opacity: 0.8 }}>{months[hover].label}{hover === cur ? " (so far)" : ""} · {months[hover].count} payment{months[hover].count === 1 ? "" : "s"}</div>
      </div>}
      {allZero && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: theme.textMuted, fontSize: 13, pointerEvents: "none" }}>No Stripe payments in the last 12 months</div>}
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
      <button onClick={() => setShowTable(s => !s)} style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 12, cursor: "pointer", fontFamily: sans }}>{showTable ? "Hide table" : "Show as table"}</button>
    </div>
    {showTable && <div className="r-tbl" style={{ marginTop: 6 }}><table style={{ width: "100%" }}><thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}><th style={th}>Month</th><th style={{ ...th, textAlign: "right" }}>Payments</th><th style={{ ...th, textAlign: "right" }}>Revenue</th></tr></thead><tbody>
      {months.map(m => <tr key={m.key} style={{ borderBottom: `1px solid ${theme.borderLight}` }}><td style={td}>{m.label}</td><td style={{ ...td, textAlign: "right", color: theme.textSecondary }}>{m.count}</td><td style={{ ...money, textAlign: "right" }}>{fmt(m.total)}</td></tr>)}
    </tbody></table></div>}
  </div>;
}

// ═══════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════
function SubscriptionsView({ subs, loading, act, canEdit, showToast, onNew }) {
  const [busy, setBusy] = useState(null);
  const [settingUp, setSettingUp] = useState(false);
  if (loading && !subs) return <Empty message="Loading…" />;
  if (!subs) return null;
  const list = subs.subscriptions || [];
  const payments = subs.payments || [];
  const run = async (id, action, data, msg) => { setBusy(id); await act(action, { id, ...data }, msg); setBusy(null); };
  const link = (s) => `${subs.baseUrl}/pay/${s.publicToken}`;

  return <div>
    {subs.configured && !subs.webhookConfigured && <Banner tone="warning" action={canEdit && <Btn size="sm" variant="primary" disabled={settingUp} icon={settingUp ? <Spin /> : undefined} onClick={async () => { setSettingUp(true); await act("setup_webhook", {}, r => `Webhook registered in Stripe (${r.events} events) — payments now update automatically`); setSettingUp(false); }}>{settingUp ? "Setting up…" : "Set up webhook"}</Btn>}>Stripe isn't sending events here yet, so statuses and payments only update when you click <b>Sync from Stripe</b>. One click registers the webhook automatically.</Banner>}

    <Card title="Recurring plans" style={{ marginBottom: 20 }}>
      {list.length === 0 ? <Empty message="No recurring plans yet. Set one up to bill a client automatically every month." action={canEdit && subs.configured && <Btn size="sm" icon={Ic.plus} onClick={onNew}>New Plan</Btn>} /> :
        <div className="r-tbl"><table style={{ width: "100%" }}><thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}>{["Client", "Plan", "Amount", "Status", "Next bill", ""].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead><tbody>
          {list.map(s => {
            const isBusy = busy === s.id;
            const pending = !s.stripeSubscriptionId && s.status === "pending";
            const live = ["active", "trialing", "past_due", "unpaid", "paused"].includes(s.status) && s.stripeSubscriptionId;
            const done = ["canceled", "incomplete_expired"].includes(s.status);
            return <tr key={s.id} style={{ borderBottom: `1px solid ${theme.borderLight}`, opacity: done ? 0.6 : 1 }}>
              <td style={td}><div style={{ fontWeight: 500 }}>{s.clientName || "—"}</div>{s.clientEmail && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{s.clientEmail}</div>}</td>
              <td style={td}><div>{s.name}</div>{s.lastSentAt && pending && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>Link emailed {fmtDate(s.lastSentAt)}</div>}</td>
              <td style={money}>{fmt(s.amount)}<div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 400, fontFamily: sans }}>{intervalLabel(s.interval, s.intervalCount)}{s.trialDays > 0 ? ` · ${s.trialDays}-day trial` : ""}</div></td>
              <td style={td}><SubStatus status={s.status} cancelAtPeriodEnd={s.cancelAtPeriodEnd} /></td>
              <td style={{ ...td, color: theme.textSecondary, whiteSpace: "nowrap" }}>{s.currentPeriodEnd ? <>{fmtDate(s.currentPeriodEnd)}{s.cancelAtPeriodEnd && <div style={{ fontSize: 11, color: theme.warning }}>ends then</div>}</> : "—"}</td>
              <td style={{ ...td, textAlign: "right" }}>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  {pending && <Btn size="sm" variant="secondary" icon={Ic.link} onClick={async () => { if (await copyText(link(s))) showToast("Payment link copied"); }} title="Copy payment link" />}
                  {pending && canEdit && <Btn size="sm" variant="blue" icon={isBusy ? <Spin /> : Ic.mail} disabled={isBusy} onClick={() => run(s.id, "send_link", {}, `Payment link emailed to ${s.clientEmail}`)} title="Email payment link" />}
                  {live && canEdit && !s.cancelAtPeriodEnd && <Btn size="sm" variant="danger" icon={isBusy ? <Spin /> : Ic.x} disabled={isBusy} onClick={() => { if (confirm(`Cancel ${s.clientName}'s "${s.name}"?\n\nOK = cancel at the end of the current period (they keep what they paid for).\nYou can also cancel immediately from the Stripe dashboard.`)) run(s.id, "cancel_subscription", { atPeriodEnd: true }, "Subscription will end at the close of the current period"); }} title="Cancel at period end">Cancel</Btn>}
                  {live && canEdit && s.cancelAtPeriodEnd && <Btn size="sm" variant="success" disabled={isBusy} onClick={() => run(s.id, "resume_subscription", {}, "Subscription resumed")}>Keep active</Btn>}
                  {(pending || done) && canEdit && <Btn size="sm" variant="ghost" icon={Ic.trash} style={{ color: theme.danger }} disabled={isBusy} onClick={() => { if (confirm(pending ? "Remove this plan? The payment link will stop working." : "Remove this canceled plan from the list?")) run(s.id, pending ? "cancel_subscription" : "delete_subscription", {}, "Removed"); }} title="Remove" />}
                </div>
              </td>
            </tr>;
          })}
        </tbody></table></div>}
    </Card>

    <Card title="Payments received">
      {payments.length === 0 ? <Empty message="Subscription payments will show up here as Stripe collects them — and post to your ledger as Revenue automatically." /> :
        <div className="r-tbl"><table style={{ width: "100%" }}><thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}>{["Date", "Client", "Plan", "Amount", ""].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead><tbody>
          {payments.map(p => <tr key={p.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
            <td style={{ ...td, color: theme.textSecondary, whiteSpace: "nowrap" }}>{fmtDate(p.paidAt)}</td>
            <td style={{ ...td, fontWeight: 500 }}>{p.clientName || "—"}</td>
            <td style={td}>{p.description}{p.invoiceNumber && <div style={{ fontSize: 11, color: theme.textMuted }}>{p.invoiceNumber}</div>}</td>
            <td style={money}>{fmt(p.amount)}</td>
            <td style={{ ...td, textAlign: "right" }}>{p.hostedInvoiceUrl && <a href={p.hostedInvoiceUrl} target="_blank" rel="noreferrer" style={{ color: theme.textMuted, display: "inline-flex" }} title="View Stripe invoice">{Ic.external}</a>}</td>
          </tr>)}
        </tbody></table></div>}
    </Card>
  </div>;
}

function NewPlanForm({ clients, onCancel, onCreated }) {
  const [form, setForm] = useState({ clientId: "", name: "Monthly Website Maintenance", description: "", amount: "", cycle: "month:1", trialDays: "", sendEmail: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const client = clients.find(c => c.id === form.clientId);
  const cycle = INTERVALS.find(i => i.id === form.cycle) || INTERVALS[0];

  useEffect(() => {
    // Default the plan name to the cycle when the user hasn't customized it
    const auto = INTERVALS.map(i => `${i.label} Website Maintenance`);
    if (auto.includes(form.name) || form.name === "") set("name", `${cycle.label} Website Maintenance`);
  }, [form.cycle]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.clientId) return setError("Pick a client");
    if (!(parseFloat(form.amount) > 0)) return setError("Enter an amount");
    setSaving(true); setError(null);
    try {
      const res = await billingPost("create_subscription", { clientId: form.clientId, name: form.name, description: form.description, amount: parseFloat(form.amount), interval: cycle.interval, intervalCount: cycle.count, trialDays: parseInt(form.trialDays) || 0, sendEmail: form.sendEmail && !!client?.email });
      onCreated(res);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    {error && <Banner tone="danger">{error}</Banner>}
    <Select label="Client *" value={form.clientId} onChange={e => set("clientId", e.target.value)}>
      <option value="">Select a client…</option>
      {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.email ? ` — ${c.email}` : " (no email)"}</option>)}
    </Select>
    {client && !client.email && <div style={{ fontSize: 12, color: theme.warning, marginTop: -8 }}>This client has no email — you'll need to copy the payment link and send it yourself.</div>}
    <Input label="Plan name *" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Monthly Website Maintenance" />
    <Textarea label="What's included (optional — shown to the client)" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Hosting, security updates, monthly backups, and up to 2 hours of content changes." />
    <div className="r-g" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
      <Input label="Amount (USD) *" type="number" min="1" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="150.00" />
      <Select label="Billed" value={form.cycle} onChange={e => set("cycle", e.target.value)}>{INTERVALS.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}</Select>
      <Input label="Free trial (days)" type="number" min="0" step="1" value={form.trialDays} onChange={e => set("trialDays", e.target.value)} placeholder="0" />
    </div>
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: theme.text, cursor: client?.email ? "pointer" : "not-allowed", opacity: client?.email ? 1 : 0.5 }}>
      <input type="checkbox" checked={form.sendEmail && !!client?.email} disabled={!client?.email} onChange={e => set("sendEmail", e.target.checked)} />
      Email the payment link to {client?.email || "the client"} now
    </label>
    <div style={{ background: theme.surfaceAlt, borderRadius: theme.radiusSm, padding: "10px 12px", fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>
      The client adds a card once on Stripe's secure checkout. Stripe then charges <b>{form.amount ? fmt(parseFloat(form.amount)) : "the amount"}</b> {cycle.label.toLowerCase()} automatically, emails them a receipt, and each payment posts to your ledger as Revenue.
    </div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
      <Btn variant="secondary" onClick={onCancel} type="button">Cancel</Btn>
      <Btn type="submit" disabled={saving} icon={saving ? <Spin /> : Ic.plus}>{saving ? "Creating…" : "Create plan"}</Btn>
    </div>
  </form>;
}

function LinkPanel({ link, emailed, emailError, sub, onClose, showToast }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    {emailed && <Banner tone="success">Payment link emailed to {sub?.clientEmail}.</Banner>}
    {emailError && <Banner tone="warning">Plan created, but the email didn't send: {emailError}. Copy the link below and send it yourself.</Banner>}
    <div style={{ fontSize: 13, color: theme.textSecondary }}>Share this link with {sub?.clientName || "the client"}. It doesn't expire, and it works only for this plan.</div>
    <div style={{ display: "flex", gap: 8 }}>
      <input readOnly value={link} onFocus={e => e.target.select()} style={{ flex: 1, padding: "8px 12px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 12, fontFamily: "ui-monospace, Menlo, monospace", background: theme.surfaceAlt, color: theme.text }} />
      <Btn variant="secondary" icon={Ic.link} onClick={async () => { if (await copyText(link)) showToast("Payment link copied"); }}>Copy</Btn>
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn onClick={onClose}>Done</Btn></div>
  </div>;
}
