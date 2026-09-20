import { getStripe, subscriptionPeriodEnd, invoiceSubscriptionId, stripeId, monthlyAmount, intervalLabel } from "./stripe";
import {
  getSubscription, getSubscriptionByStripeId, getSubscriptionByCheckoutSession, listSubscriptions,
  createSubscription, setSubscriptionCheckout, syncSubscriptionState,
  getClientById, findClientByStripeCustomer, findClientByEmail, setClientStripeCustomer,
  recordPayment, postStripeIncome, getCompanySettings,
  getInvoiceByPayToken, upsertOnlinePayment, getOnlinePayment, reconcileOnlinePayments,
  getIntegrationSetting, setIntegrationSetting,
} from "./billing-db";
import { sendReceipt, sendPlanActivated, sendRecurringPaymentAlert } from "./notify";
const quiet = (p) => p.catch(e => console.error("[notify]", e.message));

const genId = () => Math.random().toString(36).substr(2, 9);
const round2 = (n) => Math.round(n * 100) / 100;

// Offer ACH Direct Debit (cheap, ideal for recurring) alongside cards; fall back to the
// dashboard-managed methods (card) if ACH isn't activated on the Stripe account yet.
async function createSessionPreferringAch(stripe, params) {
  try {
    return await stripe.checkout.sessions.create({
      ...params,
      payment_method_types: ["us_bank_account", "card"],
      payment_method_options: { us_bank_account: { verification_method: "automatic" } },
    });
  } catch (e) {
    if (/us_bank_account|payment_method_types|payment method/i.test(e.message || "")) {
      return stripe.checkout.sessions.create(params);
    }
    throw e;
  }
}

const tsToDate = (ts) => (ts ? new Date(ts * 1000).toISOString().split("T")[0] : null);
const tsToIso = (ts) => (ts ? new Date(ts * 1000).toISOString() : null);

// ── CUSTOMERS ──
// Find or create the Stripe customer for a local client, and remember the mapping.
export async function ensureStripeCustomer(client) {
  const stripe = getStripe();
  if (client.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(client.stripe_customer_id);
      if (existing && !existing.deleted) return existing.id;
    } catch (_) { /* fall through and recreate */ }
  }
  let customerId = null;
  if (client.email) {
    const found = await stripe.customers.list({ email: client.email, limit: 1 });
    if (found.data[0]) customerId = found.data[0].id;
  }
  if (!customerId) {
    const created = await stripe.customers.create({
      name: client.name,
      email: client.email || undefined,
      phone: client.phone || undefined,
      metadata: { badjrpay_client_id: client.id },
    });
    customerId = created.id;
  }
  await setClientStripeCustomer(client.id, customerId);
  return customerId;
}

// ── CHECKOUT ──
// Create a hosted Stripe Checkout session for a pending local subscription.
export async function createCheckoutSession(sub, baseUrl) {
  const stripe = getStripe();
  let customerId = sub.stripeCustomerId || null;
  if (!customerId && sub.clientId) {
    const client = await getClientById(sub.clientId);
    if (client) customerId = await ensureStripeCustomer(client);
  }
  const returnUrl = `${baseUrl}/pay/${sub.publicToken}`;
  const session = await createSessionPreferringAch(stripe, {
    mode: "subscription",
    ...(customerId ? { customer: customerId } : { customer_email: sub.clientEmail || undefined }),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(sub.amount * 100),
        recurring: { interval: sub.interval, interval_count: sub.intervalCount || 1 },
        product_data: { name: sub.name, ...(sub.description ? { description: sub.description } : {}) },
      },
    }],
    subscription_data: {
      metadata: { badjrpay_subscription_id: sub.id, badjrpay_client_id: sub.clientId || "" },
      ...(sub.trialDays > 0 ? { trial_period_days: sub.trialDays } : {}),
    },
    metadata: { badjrpay_subscription_id: sub.id },
    success_url: `${returnUrl}?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}?status=cancel`,
    allow_promotion_codes: false,
    billing_address_collection: "auto",
  });
  await setSubscriptionCheckout(sub.id, session.id, customerId);
  return session;
}

// ── SYNC HELPERS ──
async function productNameFor(stripe, price, cache) {
  const pid = stripeId(price?.product);
  if (!pid) return price?.nickname || "Subscription";
  if (typeof price.product === "object" && price.product.name) return price.product.name;
  if (cache.has(pid)) return cache.get(pid);
  try {
    const product = await stripe.products.retrieve(pid);
    cache.set(pid, product.name);
    return product.name;
  } catch (_) {
    return price?.nickname || "Subscription";
  }
}

function subscriptionAmount(stripeSub) {
  const items = stripeSub.items?.data || [];
  const amount = items.reduce((s, i) => s + ((i.price?.unit_amount || 0) * (i.quantity || 1)), 0) / 100;
  const first = items[0]?.price?.recurring;
  return { amount, interval: first?.interval || "month", intervalCount: first?.interval_count || 1 };
}

// Mirror a live Stripe subscription into the local table (create the row if we don't know it yet).
export async function applyStripeSubscription(stripeSub, { productCache = new Map() } = {}) {
  const stripe = getStripe();
  const customerId = stripeId(stripeSub.customer);
  const state = {
    stripeSubscriptionId: stripeSub.id,
    stripeCustomerId: customerId,
    status: stripeSub.status,
    currentPeriodEnd: subscriptionPeriodEnd(stripeSub),
    cancelAtPeriodEnd: !!stripeSub.cancel_at_period_end,
    canceledAt: tsToIso(stripeSub.canceled_at),
  };

  let local = await getSubscriptionByStripeId(stripeSub.id);
  if (!local && stripeSub.metadata?.badjrpay_subscription_id) local = await getSubscription(stripeSub.metadata.badjrpay_subscription_id);

  if (local) {
    await syncSubscriptionState(local.id, state);
    if (local.clientId && customerId) await setClientStripeCustomer(local.clientId, customerId);
    return { ...local, ...state };
  }

  // Unknown to us (created in the Stripe dashboard) — adopt it.
  let client = customerId ? await findClientByStripeCustomer(customerId) : null;
  let customer = null;
  if (typeof stripeSub.customer === "object" && stripeSub.customer) customer = stripeSub.customer;
  else if (customerId) { try { customer = await stripe.customers.retrieve(customerId); } catch (_) {} }
  if (!client && customer?.email) client = await findClientByEmail(customer.email);
  if (client && customerId) await setClientStripeCustomer(client.id, customerId);

  const { amount, interval, intervalCount } = subscriptionAmount(stripeSub);
  const name = await productNameFor(stripe, stripeSub.items?.data?.[0]?.price, productCache);
  return createSubscription({
    clientId: client?.id || null,
    clientName: client?.name || customer?.name || customer?.email || "",
    clientEmail: client?.email || customer?.email || "",
    stripeCustomerId: customerId,
    stripeSubscriptionId: stripeSub.id,
    name, amount, interval, intervalCount,
    status: stripeSub.status,
    currentPeriodEnd: state.currentPeriodEnd,
  });
}

// A Checkout session finished → link the resulting Stripe subscription to our pending record.
export async function handleCheckoutCompleted(session) {
  if (session.mode !== "subscription" || !session.subscription) return null;
  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(stripeId(session.subscription));
  const localId = session.metadata?.badjrpay_subscription_id;
  const local = (localId && await getSubscription(localId)) || await getSubscriptionByCheckoutSession(session.id);
  if (local && !local.stripeSubscriptionId) {
    await syncSubscriptionState(local.id, {
      stripeSubscriptionId: stripeSub.id,
      stripeCustomerId: stripeId(session.customer),
      status: stripeSub.status,
      currentPeriodEnd: subscriptionPeriodEnd(stripeSub),
    });
    if (local.clientId) await setClientStripeCustomer(local.clientId, stripeId(session.customer));
    await quiet(sendPlanActivated({ ...local, status: stripeSub.status, currentPeriodEnd: subscriptionPeriodEnd(stripeSub) }, process.env.APP_URL));
  }
  return applyStripeSubscription(stripeSub);
}

// A Stripe invoice was paid → record it and post Revenue to the ledger (idempotent).
export async function recordPaidInvoice(inv) {
  if (inv.status !== "paid" || !(inv.amount_paid > 0)) return false;
  const stripeSubId = invoiceSubscriptionId(inv);
  const customerId = stripeId(inv.customer);
  const local = stripeSubId ? await getSubscriptionByStripeId(stripeSubId) : null;
  const client = local?.clientId ? await getClientById(local.clientId) : (customerId ? await findClientByStripeCustomer(customerId) : null);
  const paidAt = tsToDate(inv.status_transitions?.paid_at) || tsToDate(inv.created);
  const clientName = client?.name || local?.clientName || inv.customer_name || inv.customer_email || "";
  const description = local?.name || inv.lines?.data?.[0]?.description || "Stripe subscription payment";
  const amount = inv.amount_paid / 100;
  const bkTransactionId = `stripe_${inv.id}`;

  const inserted = await recordPayment({
    id: inv.id,
    stripeSubscriptionId: stripeSubId,
    stripeCustomerId: customerId,
    subscriptionId: local?.id || null,
    clientId: client?.id || local?.clientId || null,
    clientName,
    amount,
    currency: inv.currency,
    description,
    paidAt,
    hostedInvoiceUrl: inv.hosted_invoice_url || null,
    invoiceNumber: inv.number || null,
    bkTransactionId,
  });
  await postStripeIncome({
    transactionId: bkTransactionId,
    date: paidAt,
    amount,
    name: clientName,
    description: `Stripe: ${description}`,
    reference: inv.number || inv.id,
  });
  if (inserted && inv.billing_reason !== "subscription_create") await quiet(sendRecurringPaymentAlert({ clientName, description, amount, baseUrl: process.env.APP_URL }));
  return inserted;
}

// Pull everything current from Stripe: subscription states, adopted subscriptions, and paid invoices.
export async function syncFromStripe() {
  const stripe = getStripe();
  const productCache = new Map();
  let adopted = 0, updated = 0, payments = 0;

  // 1. Resolve pending checkouts that completed while we weren't listening
  for (const sub of await listSubscriptions()) {
    if (sub.stripeSubscriptionId || !sub.checkoutSessionId) continue;
    try {
      const session = await stripe.checkout.sessions.retrieve(sub.checkoutSessionId);
      if (session.status === "complete" && session.subscription) { await handleCheckoutCompleted(session); updated++; }
    } catch (_) {}
  }

  // 2. Mirror every subscription Stripe knows about
  const known = new Set((await listSubscriptions()).map(s => s.stripeSubscriptionId).filter(Boolean));
  for await (const stripeSub of stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] })) {
    if (["incomplete", "incomplete_expired"].includes(stripeSub.status) && !known.has(stripeSub.id)) continue;
    if (known.has(stripeSub.id)) updated++; else adopted++;
    await applyStripeSubscription(stripeSub, { productCache });
  }

  // 3. Record paid subscription invoices from the last 13 months
  const since = Math.floor(Date.now() / 1000) - 400 * 24 * 3600;
  for await (const inv of stripe.invoices.list({ status: "paid", created: { gte: since }, limit: 100 })) {
    if (!invoiceSubscriptionId(inv)) continue;
    if (await recordPaidInvoice(inv)) payments++;
  }

  return { adopted, updated, payments };
}

export async function cancelStripeSubscription(localId, { atPeriodEnd = true } = {}) {
  const stripe = getStripe();
  const local = await getSubscription(localId);
  if (!local) throw new Error("Subscription not found");
  if (!local.stripeSubscriptionId) {
    // Never activated — just retire the pending link
    await syncSubscriptionState(local.id, { status: "canceled", canceledAt: new Date().toISOString() });
    return local;
  }
  const stripeSub = atPeriodEnd
    ? await stripe.subscriptions.update(local.stripeSubscriptionId, { cancel_at_period_end: true })
    : await stripe.subscriptions.cancel(local.stripeSubscriptionId);
  return applyStripeSubscription(stripeSub);
}

export async function resumeStripeSubscription(localId) {
  const stripe = getStripe();
  const local = await getSubscription(localId);
  if (!local?.stripeSubscriptionId) throw new Error("Subscription is not active in Stripe");
  const stripeSub = await stripe.subscriptions.update(local.stripeSubscriptionId, { cancel_at_period_end: false });
  return applyStripeSubscription(stripeSub);
}

export async function createPortalSession(customerId, returnUrl) {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}

// ── REVENUE DASHBOARD (live from Stripe) ──
export async function getRevenueDashboard() {
  const stripe = getStripe();
  const productCache = new Map();
  const now = new Date();
  const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ key: monthKey(d), label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }), total: 0, count: 0 });
  }
  const byKey = Object.fromEntries(months.map(m => [m.key, m]));
  const since = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1) / 1000);
  const yearStart = `${now.getUTCFullYear()}-01`;

  let failedCount = 0, refunded = 0, ytd = 0;
  const recent = [];
  for await (const ch of stripe.charges.list({ created: { gte: since }, limit: 100, expand: ["data.customer"] })) {
    if (ch.status === "failed") { failedCount++; continue; }
    if (ch.status !== "succeeded") continue;
    const net = (ch.amount - (ch.amount_refunded || 0)) / 100;
    refunded += (ch.amount_refunded || 0) / 100;
    const key = monthKey(new Date(ch.created * 1000));
    if (byKey[key]) { byKey[key].total += net; byKey[key].count++; }
    if (key >= yearStart) ytd += net;
    const customer = typeof ch.customer === "object" ? ch.customer : null;
    if (recent.length < 12) recent.push({
      id: ch.id,
      date: tsToDate(ch.created),
      name: ch.billing_details?.name || customer?.name || customer?.email || ch.receipt_email || "—",
      description: ch.description || "",
      amount: ch.amount / 100,
      refunded: (ch.amount_refunded || 0) / 100,
      receiptUrl: ch.receipt_url || null,
    });
  }

  const subs = [];
  const pastDue = [];
  let mrr = 0, activeCount = 0, trialingCount = 0, next30 = 0;
  const in30 = tsToDate(Math.floor(Date.now() / 1000) + 30 * 24 * 3600);
  for await (const s of stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] })) {
    if (!["active", "trialing", "past_due", "unpaid", "paused"].includes(s.status)) continue;
    const customer = typeof s.customer === "object" ? s.customer : null;
    const { amount, interval, intervalCount } = subscriptionAmount(s);
    const plan = await productNameFor(stripe, s.items?.data?.[0]?.price, productCache);
    const nextBilling = subscriptionPeriodEnd(s);
    const row = {
      id: s.id, status: s.status, plan,
      customer: customer?.name || customer?.email || stripeId(s.customer),
      email: customer?.email || "",
      amount, interval, intervalCount, intervalLabel: intervalLabel(interval, intervalCount),
      monthly: (s.items?.data || []).reduce((t, i) => t + monthlyAmount(i.price, i.quantity || 1), 0),
      nextBilling,
      cancelAtPeriodEnd: !!s.cancel_at_period_end,
    };
    subs.push(row);
    if (s.status === "active") { activeCount++; mrr += row.monthly; if (nextBilling && nextBilling <= in30 && !row.cancelAtPeriodEnd) next30 += amount; }
    if (s.status === "trialing") trialingCount++;
    if (["past_due", "unpaid"].includes(s.status)) pastDue.push(row);
  }
  subs.sort((a, b) => (a.nextBilling || "9999").localeCompare(b.nextBilling || "9999"));

  let balance = { available: 0, pending: 0, livemode: true };
  try {
    const b = await stripe.balance.retrieve();
    balance = {
      available: b.available.filter(x => x.currency === "usd").reduce((t, x) => t + x.amount, 0) / 100,
      pending: b.pending.filter(x => x.currency === "usd").reduce((t, x) => t + x.amount, 0) / 100,
      livemode: !!b.livemode,
    };
  } catch (_) {}

  const thisMonth = months[11].total;
  const lastMonth = months[10].total;
  return {
    configured: true,
    generatedAt: new Date().toISOString(),
    livemode: balance.livemode,
    mrr, thisMonth, lastMonth, ytd,
    trailing12: months.reduce((t, m) => t + m.total, 0),
    refunded, failedCount, next30,
    activeCount, trialingCount, pastDueCount: pastDue.length,
    balance: { available: balance.available, pending: balance.pending },
    months, recentPayments: recent, subscriptions: subs, pastDue,
  };
}

// ── INVOICE PAYMENTS (one-off, against app invoices) ──
// What a client may pay right now: deposit (if outstanding), the next installment, or the full balance.
export function invoicePaymentOptions(invoice) {
  const balance = round2((invoice.total || 0) - (invoice.amountPaid || 0));
  if (balance <= 0) return [];
  const opts = [];
  const deposit = invoice.deposit || 0;
  if (deposit > 0 && (invoice.amountPaid || 0) < deposit) {
    opts.push({ kind: "deposit", amount: Math.min(round2(deposit - (invoice.amountPaid || 0)), balance), label: "Deposit" });
  }
  const nextInst = (invoice.installments || []).find(i => i.status !== "paid");
  if (nextInst && nextInst.amount > 0 && nextInst.amount <= balance) {
    opts.push({ kind: "installment", amount: round2(nextInst.amount), installmentId: nextInst.id, label: `Installment due ${nextInst.dueDate || ""}`.trim() });
  }
  opts.push({ kind: "balance", amount: balance, label: "Full balance" });
  return opts.filter((o, i, arr) => arr.findIndex(x => x.amount === o.amount) === i);
}

export async function createInvoiceCheckout(token, kind, baseUrl) {
  const data = await getInvoiceByPayToken(token);
  if (!data) throw new Error("Payment link not found");
  const { invoice } = data;
  const options = invoicePaymentOptions(invoice);
  const opt = options.find(o => o.kind === kind) || options[0];
  if (!opt) throw new Error("This invoice has no balance due");

  const stripe = getStripe();
  const { companyName } = await getCompanySettings();
  let customerId = null;
  if (invoice.clientId) {
    const client = await getClientById(invoice.clientId);
    if (client) { try { customerId = await ensureStripeCustomer(client); } catch (_) {} }
  }
  const paymentId = genId();
  const returnUrl = `${baseUrl}/pay/invoice/${token}`;
  const label = `Invoice ${invoice.number}${opt.kind === "balance" ? "" : ` — ${opt.label}`}`;
  const session = await createSessionPreferringAch(stripe, {
    mode: "payment",
    ...(customerId ? { customer: customerId } : (invoice.clientEmail ? { customer_email: invoice.clientEmail } : {})),
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Math.round(opt.amount * 100), product_data: { name: label, ...(companyName ? { description: `From ${companyName}` } : {}) } } }],
    metadata: { badjrpay_invoice_id: invoice.id, badjrpay_payment_id: paymentId, kind: opt.kind, installment_id: opt.installmentId || "" },
    payment_intent_data: { description: `${label} · ${invoice.clientName || ""}`.trim(), metadata: { badjrpay_invoice_id: invoice.id, badjrpay_payment_id: paymentId } },
    success_url: `${returnUrl}?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}?status=cancel`,
  });
  await upsertOnlinePayment({ id: paymentId, invoiceId: invoice.id, installmentId: opt.installmentId || null, kind: opt.kind, amount: opt.amount, status: "created", stripeCustomerId: customerId });
  return session;
}

// Checkout for an invoice finished (card: paid now; ACH: completes now, settles in a few days).
export async function handleInvoiceCheckout(session, eventType = "checkout.session.completed") {
  const paymentId = session.metadata?.badjrpay_payment_id;
  if (!paymentId) return null;
  const existing = await getOnlinePayment(paymentId);
  if (!existing) return null;
  const stripe = getStripe();
  const piId = stripeId(session.payment_intent);
  let method = "", receiptUrl = null, chargedAt = null;
  if (piId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
      const ch = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
      if (ch) { method = ch.payment_method_details?.type || ""; receiptUrl = ch.receipt_url || null; chargedAt = tsToDate(ch.created); }
    } catch (_) {}
  }
  const paid = session.payment_status === "paid";
  const status = paid ? "paid" : eventType === "checkout.session.async_payment_failed" ? "failed" : eventType === "checkout.session.expired" ? "expired" : "processing";
  await upsertOnlinePayment({
    id: paymentId, invoiceId: existing.invoiceId, installmentId: existing.installmentId, kind: existing.kind, amount: existing.amount,
    status, method: method === "us_bank_account" ? "ach" : method, stripePaymentIntentId: piId, stripeCustomerId: stripeId(session.customer),
    paidAt: paid ? (chargedAt || new Date().toISOString().split("T")[0]) : null, receiptUrl,
  });
  if (paid) {
    await reconcileOnlinePayments(existing.invoiceId);
    if (!(await getIntegrationSetting(`receipt:${paymentId}`))) {
      await setIntegrationSetting(`receipt:${paymentId}`, "1");
      await quiet(sendReceipt({ invoiceId: existing.invoiceId, amount: existing.amount, method: method === "us_bank_account" ? "ach" : method, receiptUrl, paidAt: chargedAt, baseUrl: process.env.APP_URL }));
    }
  }
  return { status, invoiceId: existing.invoiceId };
}

// ── WEBHOOK SELF-SETUP ──
export const WEBHOOK_EVENTS = [
  "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired",
  "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed",
  "invoice.paid", "invoice.payment_failed",
];

export async function webhookStatus(baseUrl) {
  const url = `${baseUrl}/api/stripe/webhook`;
  const configured = !!(process.env.STRIPE_WEBHOOK_SECRET || await getIntegrationSetting("stripe_webhook_secret"));
  return { url, configured, source: process.env.STRIPE_WEBHOOK_SECRET ? "env" : configured ? "app" : null };
}

// Register (or re-register) this deployment's webhook endpoint in Stripe and remember its signing secret.
export async function setupWebhook(baseUrl) {
  const stripe = getStripe();
  const url = `${baseUrl}/api/stripe/webhook`;
  // Stripe never returns an existing endpoint's secret, so replace any endpoint we made for this URL
  for await (const ep of stripe.webhookEndpoints.list({ limit: 100 })) {
    if (ep.url === url) await stripe.webhookEndpoints.del(ep.id);
  }
  const ep = await stripe.webhookEndpoints.create({ url, enabled_events: WEBHOOK_EVENTS, description: "Badjr-Pay (created from the app)" });
  await setIntegrationSetting("stripe_webhook_secret", ep.secret);
  await setIntegrationSetting("stripe_webhook_endpoint_id", ep.id);
  return { id: ep.id, url, events: WEBHOOK_EVENTS.length };
}
