"use client";
import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════
// PRODUCTS — revenue by product line (Merge, custom builds, consulting…) across Stripe, invoices and the ledger
// ═══════════════════════════════════════

const theme = {
  surface: "#FFFFFF", surfaceAlt: "#F0EDE6", border: "#E2DDD3", borderLight: "#EDE9E1",
  text: "#1A1A1A", textSecondary: "#6B6560", textMuted: "#9C9590",
  accent: "#2D5A3D", accentLight: "#E8F0EB", warning: "#C4841D", warningLight: "#FFF4E5", danger: "#B5342B", dangerLight: "#FDE8E7", success: "#2D7A4F", successLight: "#E3F5EC", blue: "#2B5EA7", blueLight: "#E8F0FB",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)", radius: "10px", radiusSm: "6px",
};
const sans = "'DM Sans', sans-serif", serif = "'Fraunces', serif";
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const fmtK = (n) => Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;
const fmtDate = (d) => { if (!d) return "—"; const [y, m, day] = String(d).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const PALETTE = ["#2E8B57", "#2B5EA7", "#C4841D", "#8E5BB5", "#B5342B", "#D4489A"]; // validated categorical set (light surface)
const UNASSIGNED = "#9C9590";
const CATEGORIES = [["saas", "SaaS"], ["custom", "Custom build"], ["consulting", "Consulting"], ["maintenance", "Maintenance"], ["other", "Other"]];

function Btn({ children, onClick, variant = "primary", size = "md", icon, style: sx, disabled, ...props }) {
  const sizes = { sm: { padding: "6px 12px", fontSize: 12 }, md: { padding: "8px 16px", fontSize: 13 } };
  const variants = { primary: { background: theme.accent, color: "#fff" }, secondary: { background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}` }, ghost: { background: "transparent", color: theme.textSecondary }, danger: { background: theme.dangerLight, color: theme.danger } };
  return <button onClick={disabled ? undefined : onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: sans, fontWeight: 500, borderRadius: theme.radiusSm, whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1, ...sizes[size], ...variants[variant], ...sx }} {...props}>{icon}{children}</button>;
}
const inputStyle = { padding: "7px 10px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: sans, background: theme.surface, color: theme.text };
function Card({ title, sub, action, children, style }) {
  return <div style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.borderLight}`, overflow: "hidden", ...style }}>
    {title && <div style={{ padding: "14px 18px", borderBottom: `1px solid ${theme.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}><div><div style={{ fontWeight: 600, fontSize: 14, fontFamily: serif }}>{title}</div>{sub && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{sub}</div>}</div>{action}</div>}
    {children}
  </div>;
}
const th = { padding: "10px 14px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.textMuted, fontWeight: 600, whiteSpace: "nowrap" };
const td = { padding: "10px 14px", fontSize: 13, verticalAlign: "middle" };

async function api(action, data) {
  const r = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body;
}

function useMeasuredWidth(ref, fallback = 720) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => { const cw = entries[0]?.contentRect?.width; if (cw) setW(Math.max(280, Math.floor(cw))); });
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  return w;
}

// Stacked monthly columns by product line
function StackedChart({ buckets, series }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const wrapRef = useRef(null);
  const W = useMeasuredWidth(wrapRef);
  const H = 260, padL = 56, padR = 16, padT = 26, padB = 30, plotW = W - padL - padR, plotH = H - padT - padB;
  const totalOf = (b) => series.reduce((t, s) => t + (b.values[s.key] || 0), 0);
  const max = Math.max(0, ...buckets.map(totalOf));
  const niceMax = (() => { if (max <= 0) return 100; const p = Math.pow(10, Math.floor(Math.log10(max))); const n = max / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; })();
  const y = (v) => padT + plotH - (v / niceMax) * plotH;
  const band = plotW / Math.max(1, buckets.length), barW = Math.min(28, band * 0.55);
  const maxIdx = buckets.reduce((bi, b, i) => (totalOf(b) > totalOf(buckets[bi]) ? i : bi), 0);
  return <div style={{ padding: "16px 18px 8px" }}>
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", fontFamily: sans }} role="img" aria-label="Revenue by product, by month">
        {[0, 0.25, 0.5, 0.75, 1].map(f => <g key={f}><line x1={padL} x2={W - padR} y1={y(f * niceMax)} y2={y(f * niceMax)} stroke={theme.borderLight} strokeWidth="1" /><text x={padL - 8} y={y(f * niceMax) + 4} textAnchor="end" fontSize="11" fill={theme.textMuted}>{fmtK(f * niceMax)}</text></g>)}
        {buckets.map((b, i) => {
          const x = padL + i * band + (band - barW) / 2; let acc = 0; const total = totalOf(b);
          const segs = series.map((s, si) => { const v = b.values[s.key] || 0; if (v <= 0) return null; const top = y(acc + v), bottom = y(acc); acc += v; const h = Math.max(0, bottom - top - (si > 0 ? 2 : 0)); const isTop = series.slice(si + 1).every(s2 => !(b.values[s2.key] > 0)); const r = isTop ? Math.min(4, h, barW / 2) : 0; const d = isTop ? `M${x},${bottom} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z` : `M${x},${bottom - h} h${barW} v${h} h${-barW} z`; return <path key={s.key} d={d} fill={s.color} opacity={hover === i ? 0.75 : 1} />; });
          return <g key={b.key}>{segs}
            {i === maxIdx && total > 0 && <text x={x + barW / 2} y={y(total) - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill={theme.textSecondary}>{fmtK(total)}</text>}
            <text x={padL + i * band + band / 2} y={H - 9} textAnchor="middle" fontSize="11" fill={theme.textMuted}>{b.label}</text>
            <rect x={padL + i * band} y={padT} width={band} height={plotH + padB} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
          </g>;
        })}
        <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke={theme.border} strokeWidth="1" />
      </svg>
      {hover != null && <div style={{ position: "absolute", left: `${((padL + hover * band + band / 2) / W) * 100}%`, top: 0, transform: `translate(${hover >= buckets.length / 2 ? "-100%" : "0"}, 0)`, background: theme.text, color: "#fff", borderRadius: 6, padding: "8px 10px", fontSize: 12, pointerEvents: "none", boxShadow: theme.shadowMd, whiteSpace: "nowrap", zIndex: 2 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, opacity: 0.85 }}>{buckets[hover].label}</div>
        {series.filter(s => buckets[hover].values[s.key] > 0).map(s => <div key={s.key} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 2, background: s.color, display: "inline-block" }} />{s.label}</span><b>{fmt(buckets[hover].values[s.key])}</b></div>)}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.25)", marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between", gap: 10 }}><span>Total</span><b>{fmt(totalOf(buckets[hover]))}</b></div>
      </div>}
      {max <= 0 && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: theme.textMuted, fontSize: 13, pointerEvents: "none" }}>No revenue in this window yet</div>}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{series.map(s => <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: theme.textSecondary }}><span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: "inline-block" }} />{s.label}</span>)}</div>
      <button onClick={() => setShowTable(v => !v)} style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 12, cursor: "pointer", fontFamily: sans }}>{showTable ? "Hide table" : "Show as table"}</button>
    </div>
    {showTable && <div className="r-tbl"><table style={{ width: "100%", marginTop: 6, fontSize: 12 }}><thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}><th style={th}>Month</th>{series.map(s => <th key={s.key} style={{ ...th, textAlign: "right" }}>{s.label}</th>)}</tr></thead><tbody>
      {buckets.map(b => <tr key={b.key} style={{ borderBottom: `1px solid ${theme.borderLight}` }}><td style={td}>{b.label}</td>{series.map(s => <td key={s.key} style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(b.values[s.key] || 0)}</td>)}</tr>)}
    </tbody></table></div>}
  </div>;
}

export function ProductsShell({ session, showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);
  const [busy, setBusy] = useState(null);
  const [newLine, setNewLine] = useState({ name: "", category: "saas" });
  const canEdit = (session?.user?.role || "owner") !== "accountant";

  const load = async (m = months) => {
    setLoading(true);
    try { const r = await fetch(`/api/products?months=${m}`, { cache: "no-store" }); const body = await r.json(); if (!r.ok) throw new Error(body.error || "Load failed"); setData(body); }
    catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  };
  useEffect(() => { load(months); }, [months]);
  const act = async (action, payload, msg) => { try { await api(action, payload); if (msg) showToast(msg); await load(); return true; } catch (e) { showToast(e.message, "error"); return false; } };

  if (loading && !data) return <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Loading…</div>;
  if (!data) return null;

  const lines = data.lines || [];
  const color = (id, i) => PALETTE[i % PALETTE.length];
  const series = [...lines.map((l, i) => ({ key: l.id, label: l.name, color: color(l.id, i) })), ...(data.totals.unassigned ? [{ key: "unassigned", label: "Unassigned", color: UNASSIGNED }] : [])];
  const grand = Object.values(data.totals).reduce((s, t) => s + t.total, 0);
  const catLabel = (c) => (CATEGORIES.find(x => x[0] === c) || [])[1] || c;

  return <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
      <h1 style={{ margin: 0, fontFamily: serif, fontSize: 24, fontWeight: 700 }}>Products</h1>
      <select value={months} onChange={e => setMonths(parseInt(e.target.value))} style={inputStyle}>{[3, 6, 12, 24].map(m => <option key={m} value={m}>Last {m} months</option>)}</select>
    </div>

    {!data.stripe && <div style={{ background: theme.warningLight, color: theme.warning, borderRadius: theme.radiusSm, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>Stripe isn't connected, so only invoices and ledger income are counted here.</div>}

    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
      {lines.map((l, i) => { const t = data.totals[l.id] || { total: 0, ytd: 0, count: 0 }; return <div key={l.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px 18px", border: `1px solid ${theme.borderLight}`, borderTop: `3px solid ${color(l.id, i)}`, flex: "1 1 180px", minWidth: 160 }}>
        <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", justifyContent: "space-between" }}><span>{l.name}</span><span style={{ textTransform: "none", letterSpacing: 0 }}>{catLabel(l.category)}</span></div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: serif, marginTop: 6 }}>{fmt(t.total)}</div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{grand > 0 ? `${Math.round(t.total / grand * 100)}% of revenue` : "—"} · {fmt(t.ytd)} YTD · {t.count} payment{t.count === 1 ? "" : "s"}</div>
      </div>; })}
      {data.totals.unassigned && <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px 18px", border: `1px dashed ${theme.border}`, flex: "1 1 180px", minWidth: 160 }}>
        <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Unassigned</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: serif, marginTop: 6, color: theme.textSecondary }}>{fmt(data.totals.unassigned.total)}</div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{data.totals.unassigned.count} item{data.totals.unassigned.count === 1 ? "" : "s"} to label below</div>
      </div>}
    </div>

    <Card title="Revenue by product" sub={`Stripe charges, paid invoices and ledger income · last ${months} months · ${fmt(grand)} total`} style={{ marginBottom: 20 }}>
      <StackedChart buckets={data.buckets} series={series} />
    </Card>

    <Card title="Unassigned revenue" sub="Label an item once — pick a product and the app remembers the pattern for everything that matches." style={{ marginBottom: 20 }}>
      {data.unassigned.length === 0 ? <div style={{ padding: "28px 20px", textAlign: "center", color: theme.textMuted, fontSize: 13 }}>Everything is labeled. New Stripe charges, invoices and deposits will classify automatically.</div> :
        <div className="r-tbl"><table style={{ width: "100%" }}><thead><tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}>{["Date", "Source", "What", "Amount", canEdit ? "Product" : ""].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead><tbody>
          {data.unassigned.map(e => <UnassignedRow key={`${e.source}:${e.id}`} e={e} lines={lines} canEdit={canEdit} busy={busy === `${e.source}:${e.id}`} onLabel={async (lineId, pattern) => { setBusy(`${e.source}:${e.id}`); await act("label", { source: e.source, id: e.id, productLineId: lineId, pattern }, pattern ? `Labeled — anything matching “${pattern}” now counts as ${lines.find(l => l.id === lineId)?.name}` : "Labeled"); setBusy(null); }} />)}
        </tbody></table></div>}
    </Card>

    <div className="r-g" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <Card title="Product lines" sub="Merge is a SaaS product; add more as you launch them">
        <div style={{ padding: "6px 0" }}>
          {lines.map((l, i) => <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", borderBottom: `1px solid ${theme.borderLight}`, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color(l.id, i), flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 500 }}>{l.name}</span>
            <span style={{ color: theme.textMuted, fontSize: 12 }}>{catLabel(l.category)}</span>
            {canEdit && <button onClick={async () => { const name = prompt("Rename product line", l.name); if (name && name !== l.name) await act("upsert_line", { ...l, name }, "Renamed"); }} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 12 }}>rename</button>}
            {canEdit && <button onClick={async () => { if (confirm(`Delete “${l.name}”? Its rules go too; revenue becomes unassigned.`)) await act("delete_line", { id: l.id }, "Deleted"); }} style={{ background: "none", border: "none", color: theme.danger, cursor: "pointer", fontSize: 12 }}>delete</button>}
          </div>)}
          {canEdit && <form onSubmit={async e => { e.preventDefault(); if (!newLine.name.trim()) return; if (await act("upsert_line", { name: newLine.name.trim(), category: newLine.category, sortOrder: 40 + lines.length }, "Product line added")) setNewLine({ name: "", category: "saas" }); }} style={{ display: "flex", gap: 8, padding: "12px 18px", flexWrap: "wrap" }}>
            <input value={newLine.name} onChange={e => setNewLine(n => ({ ...n, name: e.target.value }))} placeholder="New product (e.g. Merge Enterprise)" style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
            <select value={newLine.category} onChange={e => setNewLine(n => ({ ...n, category: e.target.value }))} style={inputStyle}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <Btn type="submit" size="sm">Add</Btn>
          </form>}
        </div>
      </Card>
      <Card title="Auto-label rules" sub="Case-insensitive “contains” matches against charge descriptions, customer names, invoice items, deposit memos">
        {data.rules.length === 0 ? <div style={{ padding: "20px", color: theme.textMuted, fontSize: 13 }}>No rules yet.</div> :
          <div style={{ padding: "6px 0" }}>{data.rules.map(r => <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", borderBottom: `1px solid ${theme.borderLight}`, fontSize: 13 }}>
            <code style={{ background: theme.surfaceAlt, padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{r.pattern}</code><span style={{ color: theme.textMuted }}>→</span><span style={{ flex: 1, fontWeight: 500 }}>{lines.find(l => l.id === r.productLineId)?.name || "?"}</span>
            {canEdit && <button onClick={() => act("delete_rule", { id: r.id }, "Rule removed")} style={{ background: "none", border: "none", color: theme.danger, cursor: "pointer", fontSize: 12 }}>remove</button>}
          </div>)}</div>}
        <div style={{ padding: "10px 18px 14px", fontSize: 12, color: theme.textMuted, borderTop: `1px solid ${theme.borderLight}` }}>Tip: in your other apps, set <code>metadata.product = "merge"</code> (or the product name) on the Stripe PaymentIntent/Checkout and it classifies itself.</div>
      </Card>
    </div>
  </div>;
}

function UnassignedRow({ e, lines, canEdit, busy, onLabel }) {
  const [lineId, setLineId] = useState("");
  const [pattern, setPattern] = useState("");
  const [open, setOpen] = useState(false);
  const suggest = () => { const words = String(e.label || e.text || "").split(/[·|,\-–—]/)[0].trim(); return words.slice(0, 40).toLowerCase(); };
  return <tr style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
    <td style={{ ...td, whiteSpace: "nowrap", color: theme.textSecondary }}>{fmtDate(e.date)}</td>
    <td style={td}><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: e.source === "stripe" ? theme.blueLight : e.source === "invoice" ? theme.accentLight : theme.surfaceAlt, color: e.source === "stripe" ? theme.blue : e.source === "invoice" ? theme.accent : theme.textSecondary }}>{e.source === "stripe" ? "Stripe" : e.source === "invoice" ? "Invoice" : "Ledger"}</span></td>
    <td style={{ ...td, maxWidth: 380 }}><div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</div>{e.text && e.text !== e.label && <div style={{ fontSize: 11, color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.text}>{e.text}</div>}</td>
    <td style={{ ...td, fontWeight: 600, fontFamily: serif, whiteSpace: "nowrap" }}>{fmt(e.amount)}</td>
    {canEdit && <td style={{ ...td, whiteSpace: "nowrap" }}>
      {!open ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select value={lineId} onChange={ev => { setLineId(ev.target.value); setPattern(suggest()); setOpen(!!ev.target.value); }} style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }}><option value="">Pick a product…</option>{lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      </div> : <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: theme.textSecondary }}>Remember when it contains</span>
        <input value={pattern} onChange={ev => setPattern(ev.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 12, width: 160 }} />
        <Btn size="sm" disabled={busy} onClick={() => onLabel(lineId, pattern.trim())}>Label + remember</Btn>
        <Btn size="sm" variant="secondary" disabled={busy || e.source === "stripe"} onClick={() => onLabel(lineId, "")} title={e.source === "stripe" ? "Stripe charges can only be labeled by rule" : "Just this one"}>Just this one</Btn>
        <button onClick={() => { setOpen(false); setLineId(""); }} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 12 }}>cancel</button>
      </div>}
    </td>}
  </tr>;
}
