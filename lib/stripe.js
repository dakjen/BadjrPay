import Stripe from "stripe";

let _stripe = null;

export function isStripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured — add STRIPE_SECRET_KEY to your environment variables");
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

// Public base URL for links we hand to clients (pay pages, Checkout return URLs).
// Prefers APP_URL, then Vercel's forwarded host, then the request origin.
export function getBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

// Newer Stripe API versions moved these fields; read both shapes.
export function subscriptionPeriodEnd(sub) {
  const fromItems = (sub?.items?.data || []).map(i => i.current_period_end).filter(Boolean);
  const ts = fromItems.length ? Math.max(...fromItems) : sub?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString().split("T")[0] : null;
}

export function invoiceSubscriptionId(inv) {
  const raw = inv?.parent?.subscription_details?.subscription ?? inv?.subscription ?? null;
  return typeof raw === "object" && raw ? raw.id : raw;
}

export function stripeId(ref) {
  return typeof ref === "object" && ref ? ref.id : ref || null;
}

// Normalize a recurring price to a monthly amount in dollars (for MRR).
export function monthlyAmount(price, quantity = 1) {
  if (!price?.recurring || price.unit_amount == null) return 0;
  const per = price.unit_amount / 100 * quantity;
  const count = price.recurring.interval_count || 1;
  switch (price.recurring.interval) {
    case "month": return per / count;
    case "year": return per / (12 * count);
    case "week": return per * 52 / 12 / count;
    case "day": return per * 365 / 12 / count;
    default: return 0;
  }
}

export function intervalLabel(interval, count = 1) {
  if (interval === "month" && count === 1) return "Monthly";
  if (interval === "month" && count === 3) return "Quarterly";
  if (interval === "month" && count === 6) return "Every 6 months";
  if (interval === "year" && count === 1) return "Yearly";
  if (interval === "week" && count === 1) return "Weekly";
  return `Every ${count} ${interval}${count > 1 ? "s" : ""}`;
}
