"use client";
import { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";

// ── Shared helpers (duplicated from InvoicingPlatform to avoid refactoring monolith) ──
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
export function BookkeepingShell({ session, showToast }) {
  const [tab, setTab] = useState("dashboard");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(0); // 0 = all months

  const role = session?.user?.role || "owner";
  const canEdit = role === "owner" || role === "admin";
  const canInput = canEdit || role === "team_member";
  const isReadOnly = role === "accountant";

  const reload = async () => {
    try {
      setLoading(true);
      const d = await bkFetch({ year: filterYear, month: filterMonth || undefined });
      setData(d);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [filterYear, filterMonth]);

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
    { id: "ledger", label: "Ledger" },
    { id: "import", label: "Import CSV" },
    { id: "reconcile", label: "Reconcile" },
    { id: "payroll", label: "Payroll" },
    { id: "contractors", label: "Contractors" },
    { id: "pnl", label: "P&L Report" },
  ];

  const years = [];
  for (let y = new Date().getFullYear(); y >= 2020; y--) years.push(y);
  const months = ["All Months", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
      <h1 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700 }}>Bookkeeping</h1>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} style={{ padding: "6px 10px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: theme.surface }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))} style={{ padding: "6px 10px", border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: theme.surface }}>
          {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
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
      {tab === "dashboard" && <BkDashboard data={data} filterYear={filterYear} />}
      {tab === "ledger" && <LedgerView data={data} act={act} showToast={showToast} canInput={canInput} canEdit={canEdit} />}
      {tab === "import" && (canInput ? <CSVImportView data={data} act={act} showToast={showToast} reload={reload} /> : <Empty message="You don't have permission to import data." />)}
      {tab === "reconcile" && <ReconcileView data={data} act={act} showToast={showToast} canInput={canInput} />}
      {tab === "payroll" && <PayrollView data={data} act={act} showToast={showToast} canInput={canInput} canEdit={canEdit} />}
      {tab === "contractors" && <ContractorView data={data} act={act} showToast={showToast} canEdit={canEdit} filterYear={filterYear} />}
      {tab === "pnl" && <PnLView filterYear={filterYear} filterMonth={filterMonth} showToast={showToast} settings={null} />}
    </>}
  </div>;
}

// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
function BkDashboard({ data, filterYear }) {
  const income = data.transactions.filter(t => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
  const expenses = data.transactions.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
  const net = income - expenses;
  const unreconciled = data.transactions.filter(t => !t.reconciled).length;

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
    if (totals && totals[filterYear] && totals[filterYear].flagged) {
      flagged.push({ name: c.name, total: totals[filterYear].total });
    }
  }

  return <div>
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
      <StatCard label="Income" value={fmt(income)} color={theme.success} />
      <StatCard label="Expenses" value={fmt(expenses)} color={theme.danger} />
      <StatCard label="Net Income" value={fmt(net)} color={net >= 0 ? theme.success : theme.danger} />
      <StatCard label="Unreconciled" value={unreconciled} color={theme.warning} />
    </div>

    {flagged.length > 0 && <div style={{ background: theme.warningLight, border: `1px solid ${theme.warning}`, borderRadius: theme.radiusSm, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: theme.warning, display: "flex", alignItems: "center", gap: 6 }}>{BkIcons.alert} 1099 Threshold Alerts ({filterYear})</div>
      {flagged.map((f, i) => <div key={i} style={{ color: theme.text, padding: "2px 0" }}>{f.name}: {fmt(f.total)} paid</div>)}
    </div>}

    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
      <div style={{ background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius, padding: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600 }}>Spending by Category</h3>
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
              </td>
              <td style={tdStyle}><span style={{ fontSize: 12, color: theme.textSecondary }}>{catMap[t.categoryId] || "—"}</span></td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: t.type === "income" ? theme.success : theme.danger }}>{t.type === "income" ? "+" : "-"}{fmt(Math.abs(t.amount))}</td>
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
      <TransactionForm item={modal === "add" ? null : modal} categories={data.categories} accounts={data.accounts} onSave={handleSave} onCancel={() => setModal(null)} />
    </Modal>
  </div>;
}

const thStyle = { textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'DM Sans', sans-serif" };
const tdStyle = { padding: "10px 10px", verticalAlign: "top" };

// ── Transaction Form ──
function TransactionForm({ item, categories, accounts, onSave, onCancel }) {
  const [form, setForm] = useState({
    date: today(), description: "", name: "", amount: "", categoryId: "", accountId: "",
    type: "expense", vendor: "", reference: "", notes: "",
    ...item,
    amount: item ? String(Math.abs(item.amount)) : "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.date || !form.amount) return;
    const amt = parseFloat(form.amount) || 0;
    onSave({ ...form, amount: form.type === "expense" ? -Math.abs(amt) : Math.abs(amt) });
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Input label="Date *" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
      <Select label="Type *" value={form.type} onChange={e => set("type", e.target.value)}>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </Select>
    </div>
    <Input label="Name" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Label for this transaction" />
    <Input label="Description" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Details" />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Input label="Amount *" type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" min="0" step="0.01" />
      <Input label="Vendor" value={form.vendor} onChange={e => set("vendor", e.target.value)} placeholder="Vendor name" />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Select label="Category" value={form.categoryId} onChange={e => set("categoryId", e.target.value)}>
        <option value="">Uncategorized</option>
        {categories.filter(c => c.type === form.type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: t.type === "income" ? theme.success : theme.danger }}>{t.type === "income" ? "+" : "-"}{fmt(Math.abs(t.amount))}</td>
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
function PnLView({ filterYear, filterMonth, showToast }) {
  const [pnlData, setPnlData] = useState(null);
  const [loading, setLoading] = useState(true);

  const startDate = filterMonth > 0
    ? `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`
    : `${filterYear}-01-01`;
  const endDate = filterMonth > 0
    ? `${filterYear}-${String(filterMonth).padStart(2, "0")}-${new Date(filterYear, filterMonth, 0).getDate()}`
    : `${filterYear}-12-31`;

  useEffect(() => {
    setLoading(true);
    bkFetch({ report: "pnl", start: startDate, end: endDate })
      .then(d => setPnlData(d.pnl))
      .catch(e => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Loading...</div>;
  if (!pnlData) return <Empty message="No P&L data available." />;

  // Group by sections
  const income = pnlData.filter(r => r.type === "income" && r.total > 0);
  const cogs = pnlData.filter(r => (r.categoryId === "bkc_cogs" || r.parent === "bkc_cogs") && r.total > 0);
  const cogsIds = new Set(cogs.map(r => r.categoryId));
  const payrollIds = new Set(["bkc_wages", "bkc_payroll_tax", "bkc_benefits"]);
  const contractorIds = new Set(["bkc_contractor"]);
  const payrollItems = pnlData.filter(r => payrollIds.has(r.categoryId) && r.total > 0);
  const contractorItems = pnlData.filter(r => contractorIds.has(r.categoryId) && r.total > 0);
  const opex = pnlData.filter(r => r.type === "expense" && r.total > 0 && !cogsIds.has(r.categoryId) && !payrollIds.has(r.categoryId) && !contractorIds.has(r.categoryId) && r.parent !== "bkc_cogs");

  const totalIncome = income.reduce((s, r) => s + r.total, 0);
  const totalCogs = cogs.reduce((s, r) => s + r.total, 0);
  const grossProfit = totalIncome - totalCogs;
  const totalOpex = opex.reduce((s, r) => s + r.total, 0);
  const totalPayroll = payrollItems.reduce((s, r) => s + r.total, 0);
  const totalContractor = contractorItems.reduce((s, r) => s + r.total, 0);
  const netIncome = grossProfit - totalOpex - totalPayroll - totalContractor;

  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const periodLabel = filterMonth > 0 ? `${monthNames[filterMonth]} ${filterYear}` : `January - December ${filterYear}`;

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
    exportCSV(rows, `pnl_${filterYear}${filterMonth ? `_${filterMonth}` : ""}.csv`);
    showToast("Exported P&L CSV");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const W = 210, margin = 20, cW = W - margin * 2;
    let y = 20;

    // Header
    doc.setFillColor(45, 90, 61);
    doc.rect(0, 0, W, 36, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("Profit & Loss Statement", margin, 18);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(periodLabel, margin, 28);

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

    addSection("Income", income, totalIncome);
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
    doc.setDrawColor(45, 90, 61); doc.setLineWidth(0.5);
    doc.line(margin, y, margin + cW, y); y += 8;
    doc.setTextColor(45, 90, 61);
    doc.text("NET INCOME", margin, y);
    doc.text(fmt(netIncome), margin + cW, y, { align: "right" });

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `PnL_${filterYear}${filterMonth ? `_${filterMonth}` : ""}.pdf`; a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded P&L PDF");
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
      <div>
        <h3 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600 }}>Profit & Loss Statement</h3>
        <div style={{ fontSize: 13, color: theme.textSecondary }}>{periodLabel}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn size="sm" variant="secondary" icon={BkIcons.download} onClick={handleExportCSV}>CSV</Btn>
        <Btn size="sm" variant="secondary" icon={BkIcons.download} onClick={handleExportPDF}>PDF</Btn>
      </div>
    </div>

    <div style={{ background: theme.surface, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius, padding: 24 }}>
      {income.length > 0 && <Section title="Income" items={income} total={totalIncome} />}
      {cogs.length > 0 && <Section title="Cost of Goods Sold" items={cogs} total={totalCogs} />}

      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `2px solid ${theme.borderLight}`, borderBottom: `2px solid ${theme.borderLight}`, marginBottom: 20, fontWeight: 700, fontSize: 15, fontFamily: "'Fraunces', serif" }}>
        <span>Gross Profit</span>
        <span style={{ color: grossProfit >= 0 ? theme.success : theme.danger }}>{fmt(grossProfit)}</span>
      </div>

      {opex.length > 0 && <Section title="Operating Expenses" items={opex} total={totalOpex} />}
      {payrollItems.length > 0 && <Section title="Payroll Expenses" items={payrollItems} total={totalPayroll} />}
      {contractorItems.length > 0 && <Section title="Contractor Payments" items={contractorItems} total={totalContractor} />}

      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: `3px solid ${theme.accent}`, marginTop: 10, fontWeight: 700, fontSize: 18, fontFamily: "'Fraunces', serif" }}>
        <span>Net Income</span>
        <span style={{ color: netIncome >= 0 ? theme.success : theme.danger }}>{fmt(netIncome)}</span>
      </div>
    </div>
  </div>;
}
