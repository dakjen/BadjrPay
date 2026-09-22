import { initDb } from "@/lib/db";
import { getSubscriptionByToken, getCompanySettings } from "@/lib/billing-db";
import { getStripe, isStripeConfigured, intervalLabel } from "@/lib/stripe";
import { handleCheckoutCompleted } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up payment — Badjr-Pay", robots: { index: false, follow: false } };

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const fmtDate = (iso) => { if (!iso) return null; const [y, m, d] = iso.split("-"); return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); };

const c = { bg: "#F7F5F0", surface: "#FFFFFF", border: "#E2DDD3", borderLight: "#EDE9E1", text: "#1A1A1A", textSecondary: "#6B6560", textMuted: "#9C9590", accent: "#476C2E", accentLight: "#EAF1E3", success: "#3F7A2E", successLight: "#E6F1DE", warning: "#B8811A", warningLight: "#FFF3DC", danger: "#8A1C1C", dangerLight: "#F7E5E5" };
const serif = "'Fraunces', Georgia, serif";
const sans = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function Shell({ companyName, children }) {
  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: sans, color: c.text, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:wght@600;700&display=swap" />
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/CLEARGREEN-BADJR.png" alt="BaDjR" style={{ height: 40, display: "block", margin: "0 auto 10px" }} />
          <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: c.accent }}>{companyName || "BaDjR Tech"}</div>
        </div>
        <div style={{ background: c.surface, border: `1px solid ${c.borderLight}`, borderRadius: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.06)", padding: "28px 28px 24px" }}>{children}</div>
        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: c.textMuted }}>Payments are processed securely by Stripe. Card details never touch our servers.</div>
      </div>
    </div>
  );
}

function Banner({ tone, children }) {
  const tones = { success: { bg: c.successLight, color: c.success }, warning: { bg: c.warningLight, color: c.warning }, danger: { bg: c.dangerLight, color: c.danger } };
  const t = tones[tone] || tones.warning;
  return <div style={{ background: t.bg, color: t.color, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 500, marginBottom: 18 }}>{children}</div>;
}

function Row({ label, value, strong }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 14, alignItems: "baseline" }}><span style={{ color: c.textSecondary, minWidth: 0, overflowWrap: "anywhere" }}>{label}</span><span style={{ fontWeight: strong ? 700 : 500, textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>{value}</span></div>;
}

export default async function PayPage({ params, searchParams }) {
  const { token } = await params;
  const { status, session_id: sessionId, error } = await searchParams;
  await initDb();
  const { companyName } = await getCompanySettings();
  let sub = await getSubscriptionByToken(token);

  if (!sub) {
    return <Shell companyName={companyName}><h1 style={{ fontFamily: serif, fontSize: 22, margin: "0 0 8px" }}>Link not found</h1><p style={{ color: c.textSecondary, fontSize: 14, margin: 0 }}>This payment link isn't valid. Please contact {companyName || "us"} for a new one.</p></Shell>;
  }

  // Coming back from Stripe Checkout: confirm the session ourselves so the page is right even before the webhook lands.
  if (status === "success" && sessionId && !sub.stripeSubscriptionId && isStripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.status === "complete" && session.metadata?.badjrpay_subscription_id === sub.id) {
        await handleCheckoutCompleted(session);
        sub = await getSubscriptionByToken(token);
      }
    } catch (_) {}
  }

  const cadence = intervalLabel(sub.interval, sub.intervalCount);
  const live = !!sub.stripeSubscriptionId && !["canceled", "incomplete_expired"].includes(sub.status);
  const first = sub.trialDays > 0 ? `After your ${sub.trialDays}-day free trial` : "Today, then automatically";

  if (live || status === "already") {
    return <Shell companyName={companyName}>
      <Banner tone="success">✓ You're all set — your recurring plan is active.</Banner>
      <h1 style={{ fontFamily: serif, fontSize: 22, margin: "0 0 4px" }}>{sub.name}</h1>
      <p style={{ color: c.textSecondary, fontSize: 14, margin: "0 0 18px" }}>Thanks, {sub.clientName || "friend"}. A receipt from Stripe is on its way to your inbox each time a payment goes through.</p>
      <Row label="Amount" value={`${fmt(sub.amount)} · ${cadence}`} strong />
      {sub.currentPeriodEnd && <Row label={sub.cancelAtPeriodEnd ? "Ends on" : "Next payment"} value={fmtDate(sub.currentPeriodEnd)} />}
      <Row label="Status" value={sub.status === "trialing" ? "Free trial" : sub.status === "past_due" ? "Payment needed" : "Active"} />
      <p style={{ color: c.textMuted, fontSize: 12, margin: "18px 0 0" }}>Need to change your card or cancel? Reply to any invoice email or contact {companyName || "us"} and we'll take care of it.</p>
    </Shell>;
  }

  if (sub.status === "canceled" || error === "canceled") {
    return <Shell companyName={companyName}>
      <Banner tone="warning">This payment link is no longer active.</Banner>
      <p style={{ color: c.textSecondary, fontSize: 14, margin: 0 }}>Please contact {companyName || "us"} if you'd like to set up a new plan.</p>
    </Shell>;
  }

  const configured = isStripeConfigured();
  return <Shell companyName={companyName}>
    {status === "cancel" && <Banner tone="warning">No charge was made. You can finish setting up whenever you're ready.</Banner>}
    {error === "checkout" && <Banner tone="danger">Something went wrong starting checkout. Please try again in a moment.</Banner>}
    {error === "unavailable" || !configured ? <Banner tone="danger">Online payments aren't available right now. Please contact {companyName || "us"} directly.</Banner> : null}
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.textMuted, marginBottom: 6 }}>Recurring plan</div>
    <h1 style={{ fontFamily: serif, fontSize: 24, margin: "0 0 6px", lineHeight: 1.2 }}>{sub.name}</h1>
    {sub.description && <p style={{ color: c.textSecondary, fontSize: 14, margin: "0 0 16px", lineHeight: 1.5 }}>{sub.description}</p>}
    <div style={{ margin: "14px 0 20px" }}>
      <Row label="Billed to" value={sub.clientName || sub.clientEmail || "—"} />
      <Row label="Amount" value={`${fmt(sub.amount)} · ${cadence}`} strong />
      {sub.trialDays > 0 && <Row label="Free trial" value={`${sub.trialDays} days`} />}
      <Row label="First charge" value={first} />
    </div>
    <form method="POST" action={`/api/pay/${token}`}>
      <button type="submit" disabled={!configured} style={{ width: "100%", padding: "14px 20px", border: "none", borderRadius: 8, background: configured ? c.accent : c.border, color: "#fff", fontFamily: sans, fontSize: 15, fontWeight: 600, cursor: configured ? "pointer" : "not-allowed" }}>Continue to secure payment →</button>
    </form>
    <p style={{ color: c.textMuted, fontSize: 12, margin: "14px 0 0", lineHeight: 1.5 }}>You'll enter your card on Stripe's secure checkout page. Your plan renews automatically {cadence.toLowerCase()} until you cancel.</p>
  </Shell>;
}
