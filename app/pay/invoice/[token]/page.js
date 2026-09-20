import { initDb } from "@/lib/db";
import { getInvoiceByPayToken, getCompanySettings, listAttachments } from "@/lib/billing-db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { handleInvoiceCheckout, invoicePaymentOptions } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pay invoice — Badjr-Pay", robots: { index: false, follow: false } };

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const fmtDate = (iso) => { if (!iso) return null; const [y, m, d] = iso.split("-"); return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); };

const c = { bg: "#F7F5F0", surface: "#FFFFFF", surfaceAlt: "#F0EDE6", border: "#E2DDD3", borderLight: "#EDE9E1", text: "#1A1A1A", textSecondary: "#6B6560", textMuted: "#9C9590", accent: "#2D5A3D", success: "#2D7A4F", successLight: "#E3F5EC", warning: "#C4841D", warningLight: "#FFF4E5", danger: "#B5342B", dangerLight: "#FDE8E7" };
const serif = "'Fraunces', Georgia, serif";
const sans = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function Shell({ companyName, children }) {
  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: sans, color: c.text, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:wght@600;700&display=swap" />
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: c.accent, color: "#fff", fontFamily: serif, fontSize: 22, fontWeight: 700, marginBottom: 10 }}>B</div>
          <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: c.accent }}>{companyName || "BaDjR Tech"}</div>
        </div>
        <div style={{ background: c.surface, border: `1px solid ${c.borderLight}`, borderRadius: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.06)", padding: "28px 28px 24px" }}>{children}</div>
        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: c.textMuted }}>Payments are processed securely by Stripe. Pay by bank account (ACH) or card.</div>
      </div>
    </div>
  );
}
function Banner({ tone, children }) {
  const tones = { success: { bg: c.successLight, color: c.success }, warning: { bg: c.warningLight, color: c.warning }, danger: { bg: c.dangerLight, color: c.danger } };
  const t = tones[tone] || tones.warning;
  return <div style={{ background: t.bg, color: t.color, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 500, marginBottom: 18 }}>{children}</div>;
}
function Row({ label, value, strong, muted }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 14 }}><span style={{ color: c.textSecondary }}>{label}</span><span style={{ fontWeight: strong ? 700 : 500, color: muted ? c.textMuted : c.text, textAlign: "right" }}>{value}</span></div>;
}

export default async function InvoicePayPage({ params, searchParams }) {
  const { token } = await params;
  const { status, session_id: sessionId, error } = await searchParams;
  await initDb();
  const { companyName } = await getCompanySettings();
  let data = await getInvoiceByPayToken(token);

  if (!data) {
    return <Shell companyName={companyName}><h1 style={{ fontFamily: serif, fontSize: 22, margin: "0 0 8px" }}>Link not found</h1><p style={{ color: c.textSecondary, fontSize: 14, margin: 0 }}>This payment link isn't valid. Please contact {companyName || "us"} for a new one.</p></Shell>;
  }

  // Back from Stripe: confirm the session ourselves so the page is right even before the webhook arrives.
  let justPaid = null;
  if (status === "success" && sessionId && isStripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
      if (session.metadata?.badjrpay_invoice_id === data.invoice.id) {
        justPaid = await handleInvoiceCheckout(session);
        data = await getInvoiceByPayToken(token);
      }
    } catch (_) {}
  }

  const { invoice, payments } = data;
  const docs = await listAttachments(invoice.id);
  const balance = Math.round(((invoice.total || 0) - (invoice.amountPaid || 0)) * 100) / 100;
  const options = invoicePaymentOptions(invoice);
  const processing = payments.filter(p => p.status === "processing");
  const configured = isStripeConfigured();

  return <Shell companyName={companyName}>
    {justPaid?.status === "paid" && <Banner tone="success">✓ Payment received — thank you! A receipt from Stripe is on its way to your inbox.</Banner>}
    {justPaid?.status === "processing" && <Banner tone="success">✓ Bank payment started — thank you! ACH transfers take about 4 business days to clear; we'll mark the invoice paid once it does.</Banner>}
    {status === "cancel" && <Banner tone="warning">No charge was made. You can come back and pay whenever you're ready.</Banner>}
    {error === "checkout" && <Banner tone="danger">Something went wrong starting checkout. Please try again in a moment.</Banner>}
    {(error === "unavailable" || !configured) && balance > 0 && <Banner tone="danger">Online payments aren't available right now. Please contact {companyName || "us"} directly.</Banner>}

    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.textMuted, marginBottom: 6 }}>Invoice {invoice.number}</div>
    <h1 style={{ fontFamily: serif, fontSize: 24, margin: "0 0 4px", lineHeight: 1.2 }}>{balance > 0 ? fmt(balance) : "Paid in full"}</h1>
    <p style={{ color: c.textSecondary, fontSize: 14, margin: "0 0 16px" }}>{balance > 0 ? "balance due" : "Nothing left to pay — thank you!"}{invoice.dueDate && balance > 0 ? ` · due ${fmtDate(invoice.dueDate)}` : ""}</p>

    <div style={{ margin: "0 0 20px" }}>
      <Row label="Billed to" value={invoice.clientName || invoice.clientEmail || "—"} />
      {invoice.items.slice(0, 6).map((it, i) => <Row key={i} label={it.description || "Item"} value={fmt(it.amount)} muted />)}
      {invoice.items.length > 6 && <Row label={`+ ${invoice.items.length - 6} more`} value="" muted />}
      <Row label="Invoice total" value={fmt(invoice.total)} strong />
      {invoice.amountPaid > 0 && <Row label="Paid so far" value={`− ${fmt(invoice.amountPaid)}`} />}
      {processing.length > 0 && <Row label="Bank payment clearing" value={fmt(processing.reduce((s, p) => s + p.amount, 0))} muted />}
    </div>

    {docs.length > 0 && <div style={{ margin: "0 0 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.textMuted, marginBottom: 6 }}>Documents</div>
      {docs.map(d => <a key={d.id} href={d.url} target="_blank" rel="noreferrer" style={{ display: "block", padding: "8px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 14, color: c.accent, textDecoration: "none", fontWeight: 500 }}>{d.filename} ↗</a>)}
    </div>}
    {balance > 0 && configured && options.length > 0 && <form method="POST" action={`/api/pay/invoice/${token}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((o, i) => <button key={o.kind} type="submit" name="kind" value={o.kind} style={{ width: "100%", padding: "13px 18px", border: i === 0 ? "none" : `1px solid ${c.border}`, borderRadius: 8, background: i === 0 ? c.accent : c.surface, color: i === 0 ? "#fff" : c.text, fontFamily: sans, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{i === 0 ? "Pay " : ""}{o.label.toLowerCase().startsWith("installment") ? o.label : o.label.toLowerCase()}</span><span>{fmt(o.amount)}</span>
      </button>)}
    </form>}
    <p style={{ color: c.textMuted, fontSize: 12, margin: "14px 0 0", lineHeight: 1.5 }}>{balance > 0 ? "You'll choose bank account (ACH) or card on Stripe's secure checkout page." : ""}</p>
  </Shell>;
}
