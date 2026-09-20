import { getStripe, isStripeConfigured, stripeId } from "./stripe";
import { listProductLines, listProductRules, listRevenueSources } from "./products-db";

const toISO = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || "").slice(0, 10));
const tsToDate = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);

export function classify(text, rules) {
  const t = String(text || "").toLowerCase();
  if (!t) return null;
  for (const r of rules) if (t.includes(r.pattern)) return r.productLineId;
  return null;
}

// Every dollar of revenue in the window, with the text we can match rules against.
export async function collectRevenueEvents(months = 12) {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const sinceISO = since.toISOString().slice(0, 10);
  const [lines, rules, sources] = await Promise.all([listProductLines(), listProductRules(), listRevenueSources(sinceISO)]);
  const events = [];

  for (const inv of sources.invoices) {
    const text = [inv.number, inv.client_name, inv.items, inv.project].filter(Boolean).join(" · ");
    events.push({ source: "invoice", id: inv.id, date: toISO(inv.paid_on), amount: parseFloat(inv.total), text, label: `${inv.number} · ${inv.client_name}`, explicit: inv.product_line_id || null, lineId: inv.product_line_id || classify(text, rules) });
  }
  for (const t of sources.ledger) {
    const text = [t.name, t.description, t.vendor, t.reference].filter(Boolean).join(" · ");
    events.push({ source: "ledger", id: t.id, date: toISO(t.date), amount: parseFloat(t.amount), text, label: t.name || t.description || "Deposit", explicit: t.product_line_id || null, lineId: t.product_line_id || classify(text, rules) });
  }

  if (isStripeConfigured()) {
    const stripe = getStripe();
    // product names per customer from their subscriptions → lets "Merge Pro" charges classify even when the charge text is bland
    const custProducts = new Map();
    const productCache = new Map();
    const productName = async (ref) => { const id = stripeId(ref); if (!id) return ""; if (typeof ref === "object" && ref?.name) return ref.name; if (!productCache.has(id)) { try { productCache.set(id, (await stripe.products.retrieve(id)).name); } catch { productCache.set(id, ""); } } return productCache.get(id); };
    try {
      for await (const s of stripe.subscriptions.list({ status: "all", limit: 100 })) {
        const names = [];
        for (const it of s.items?.data || []) { const n = await productName(it.price?.product); if (n) names.push(n); }
        const cid = stripeId(s.customer);
        if (cid && names.length) custProducts.set(cid, [...new Set([...(custProducts.get(cid) || []), ...names])]);
      }
    } catch (_) {}
    for await (const ch of stripe.charges.list({ created: { gte: Math.floor(since.getTime() / 1000) }, limit: 100, expand: ["data.customer"] })) {
      if (ch.status !== "succeeded") continue;
      if (ch.metadata?.badjrpay_invoice_id) continue; // paid one of our invoices — already counted as that invoice
      const customer = typeof ch.customer === "object" ? ch.customer : null;
      const cid = stripeId(ch.customer);
      const meta = Object.entries(ch.metadata || {}).map(([k, v]) => `${k}:${v}`).join(" ");
      const text = [ch.description, ch.calculated_statement_descriptor, ch.statement_descriptor, meta, ...(custProducts.get(cid) || []), customer?.name, customer?.email, ch.billing_details?.name].filter(Boolean).join(" · ");
      const amount = (ch.amount - (ch.amount_refunded || 0)) / 100;
      if (amount <= 0) continue;
      events.push({ source: "stripe", id: ch.id, date: tsToDate(ch.created), amount, text, label: ch.description || (custProducts.get(cid) || [])[0] || customer?.name || "Stripe charge", explicit: null, lineId: classify(text, rules) });
    }
  }
  return { lines, rules, events, sinceISO, months };
}

export async function productReport(months = 12) {
  const { lines, rules, events, sinceISO } = await collectRevenueEvents(months);
  const now = new Date();
  const keys = Array.from({ length: months }, (_, i) => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1)); return d.toISOString().slice(0, 7); });
  const buckets = keys.map(k => ({ key: k, label: new Date(k + "-01T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }), values: {} }));
  const year = String(now.getUTCFullYear());
  const totals = {};
  const bucketOf = (date) => buckets.find(b => b.key === String(date).slice(0, 7));
  for (const e of events) {
    const key = e.lineId || "unassigned";
    totals[key] ||= { total: 0, ytd: 0, count: 0 };
    totals[key].total += e.amount; totals[key].count++;
    if (String(e.date).startsWith(year)) totals[key].ytd += e.amount;
    const b = bucketOf(e.date); if (b) b.values[key] = (b.values[key] || 0) + e.amount;
  }
  const unassigned = events.filter(e => !e.lineId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);
  return { lines, rules, buckets, totals, unassigned, sinceISO, stripe: isStripeConfigured(), eventCount: events.length };
}
