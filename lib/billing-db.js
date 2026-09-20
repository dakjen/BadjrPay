import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";

const sql = neon(process.env.DATABASE_URL);

const genId = () => Math.random().toString(36).substr(2, 9);
const toISODate = (d) => (d ? String(d).slice(0, 10) : null);

// ── SCHEMA ──
export async function initBillingDb() {
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS stripe_subscriptions (
      id TEXT PRIMARY KEY,
      public_token TEXT UNIQUE NOT NULL,
      client_id TEXT,
      client_name TEXT DEFAULT '',
      client_email TEXT DEFAULT '',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT UNIQUE,
      checkout_session_id TEXT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      amount NUMERIC(10,2) NOT NULL,
      interval TEXT NOT NULL DEFAULT 'month',
      interval_count INTEGER NOT NULL DEFAULT 1,
      trial_days INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      cancel_at_period_end BOOLEAN DEFAULT FALSE,
      current_period_end DATE,
      last_sent_at TIMESTAMPTZ,
      canceled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS stripe_payments (
      id TEXT PRIMARY KEY,
      stripe_subscription_id TEXT,
      stripe_customer_id TEXT,
      subscription_id TEXT,
      client_id TEXT,
      client_name TEXT DEFAULT '',
      amount NUMERIC(10,2) NOT NULL,
      currency TEXT DEFAULT 'usd',
      description TEXT DEFAULT '',
      paid_at DATE,
      hosted_invoice_url TEXT,
      invoice_number TEXT,
      bk_transaction_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await initInvoicePayDb();
  await sql`
    CREATE TABLE IF NOT EXISTS stripe_events (
      id TEXT PRIMARY KEY,
      type TEXT,
      processed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

function mapSub(r) {
  return {
    id: r.id,
    publicToken: r.public_token,
    clientId: r.client_id,
    clientName: r.client_name,
    clientEmail: r.client_email,
    stripeCustomerId: r.stripe_customer_id,
    stripeSubscriptionId: r.stripe_subscription_id,
    checkoutSessionId: r.checkout_session_id,
    name: r.name,
    description: r.description,
    amount: parseFloat(r.amount),
    interval: r.interval,
    intervalCount: r.interval_count,
    trialDays: r.trial_days || 0,
    status: r.status,
    cancelAtPeriodEnd: !!r.cancel_at_period_end,
    currentPeriodEnd: toISODate(r.current_period_end),
    lastSentAt: r.last_sent_at ? new Date(r.last_sent_at).toISOString() : null,
    canceledAt: r.canceled_at ? new Date(r.canceled_at).toISOString() : null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  };
}

// ── SUBSCRIPTIONS ──
export async function listSubscriptions() {
  const rows = await sql`SELECT * FROM stripe_subscriptions ORDER BY created_at DESC`;
  return rows.map(mapSub);
}

export async function getSubscription(id) {
  const rows = await sql`SELECT * FROM stripe_subscriptions WHERE id = ${id}`;
  return rows[0] ? mapSub(rows[0]) : null;
}

export async function getSubscriptionByToken(token) {
  const rows = await sql`SELECT * FROM stripe_subscriptions WHERE public_token = ${token}`;
  return rows[0] ? mapSub(rows[0]) : null;
}

export async function getSubscriptionByStripeId(stripeSubscriptionId) {
  const rows = await sql`SELECT * FROM stripe_subscriptions WHERE stripe_subscription_id = ${stripeSubscriptionId}`;
  return rows[0] ? mapSub(rows[0]) : null;
}

export async function getSubscriptionByCheckoutSession(sessionId) {
  const rows = await sql`SELECT * FROM stripe_subscriptions WHERE checkout_session_id = ${sessionId}`;
  return rows[0] ? mapSub(rows[0]) : null;
}

export async function createSubscription(s) {
  const id = s.id || genId();
  const token = randomBytes(16).toString("hex");
  const rows = await sql`
    INSERT INTO stripe_subscriptions (id, public_token, client_id, client_name, client_email, stripe_customer_id, stripe_subscription_id, name, description, amount, interval, interval_count, trial_days, status, current_period_end)
    VALUES (${id}, ${token}, ${s.clientId || null}, ${s.clientName || ""}, ${s.clientEmail || ""}, ${s.stripeCustomerId || null}, ${s.stripeSubscriptionId || null}, ${s.name}, ${s.description || ""}, ${s.amount}, ${s.interval || "month"}, ${s.intervalCount || 1}, ${s.trialDays || 0}, ${s.status || "pending"}, ${s.currentPeriodEnd || null})
    RETURNING *
  `;
  return mapSub(rows[0]);
}

export async function setSubscriptionCheckout(id, sessionId, stripeCustomerId) {
  await sql`UPDATE stripe_subscriptions SET checkout_session_id = ${sessionId}, stripe_customer_id = COALESCE(${stripeCustomerId || null}, stripe_customer_id), updated_at = NOW() WHERE id = ${id}`;
}

export async function markSubscriptionSent(id) {
  await sql`UPDATE stripe_subscriptions SET last_sent_at = NOW(), updated_at = NOW() WHERE id = ${id}`;
}

// Apply the live state of a Stripe subscription to a local record.
export async function syncSubscriptionState(id, { stripeSubscriptionId, stripeCustomerId, status, currentPeriodEnd, cancelAtPeriodEnd, canceledAt }) {
  await sql`
    UPDATE stripe_subscriptions SET
      stripe_subscription_id = COALESCE(${stripeSubscriptionId || null}, stripe_subscription_id),
      stripe_customer_id = COALESCE(${stripeCustomerId || null}, stripe_customer_id),
      status = COALESCE(${status || null}, status),
      current_period_end = COALESCE(${currentPeriodEnd || null}, current_period_end),
      cancel_at_period_end = COALESCE(${cancelAtPeriodEnd ?? null}, cancel_at_period_end),
      canceled_at = COALESCE(${canceledAt || null}, canceled_at),
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteSubscription(id) {
  await sql`DELETE FROM stripe_subscriptions WHERE id = ${id}`;
}

// ── CLIENTS ──
export async function getClientById(id) {
  const rows = await sql`SELECT * FROM clients WHERE id = ${id}`;
  return rows[0] || null;
}

export async function findClientByStripeCustomer(customerId) {
  const rows = await sql`SELECT * FROM clients WHERE stripe_customer_id = ${customerId} LIMIT 1`;
  return rows[0] || null;
}

export async function findClientByEmail(email) {
  if (!email) return null;
  const rows = await sql`SELECT * FROM clients WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;
  return rows[0] || null;
}

export async function setClientStripeCustomer(clientId, customerId) {
  if (!clientId || !customerId) return;
  await sql`UPDATE clients SET stripe_customer_id = ${customerId} WHERE id = ${clientId} AND (stripe_customer_id IS NULL OR stripe_customer_id = '')`;
}

// ── PAYMENTS ──
// Insert-once by Stripe invoice id; returns true when newly recorded.
export async function recordPayment(p) {
  const rows = await sql`
    INSERT INTO stripe_payments (id, stripe_subscription_id, stripe_customer_id, subscription_id, client_id, client_name, amount, currency, description, paid_at, hosted_invoice_url, invoice_number, bk_transaction_id)
    VALUES (${p.id}, ${p.stripeSubscriptionId || null}, ${p.stripeCustomerId || null}, ${p.subscriptionId || null}, ${p.clientId || null}, ${p.clientName || ""}, ${p.amount}, ${p.currency || "usd"}, ${p.description || ""}, ${p.paidAt || null}, ${p.hostedInvoiceUrl || null}, ${p.invoiceNumber || null}, ${p.bkTransactionId || null})
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0;
}

export async function listPayments(limit = 50) {
  const rows = await sql`SELECT * FROM stripe_payments ORDER BY paid_at DESC, created_at DESC LIMIT ${limit}`;
  return rows.map(r => ({
    id: r.id,
    stripeSubscriptionId: r.stripe_subscription_id,
    subscriptionId: r.subscription_id,
    clientId: r.client_id,
    clientName: r.client_name,
    amount: parseFloat(r.amount),
    currency: r.currency,
    description: r.description,
    paidAt: toISODate(r.paid_at),
    hostedInvoiceUrl: r.hosted_invoice_url,
    invoiceNumber: r.invoice_number,
    bkTransactionId: r.bk_transaction_id,
  }));
}

// Post a Stripe payment to the bookkeeping ledger as Revenue (idempotent by id).
export async function postStripeIncome({ transactionId, date, amount, name, description, reference }) {
  await sql`
    INSERT INTO bk_transactions (id, date, description, name, amount, category_id, type, reference, notes, reviewed, source)
    VALUES (${transactionId}, ${date}, ${description || "Stripe payment"}, ${name || ""}, ${Math.abs(amount)}, 'bkc_revenue', 'income', ${reference || ""}, 'Auto-posted from Stripe', TRUE, 'stripe')
    ON CONFLICT (id) DO NOTHING
  `;
}

// ── WEBHOOK IDEMPOTENCY ──
export async function hasProcessedEvent(id) {
  const rows = await sql`SELECT 1 FROM stripe_events WHERE id = ${id}`;
  return rows.length > 0;
}

export async function markEventProcessed(id, type) {
  await sql`INSERT INTO stripe_events (id, type) VALUES (${id}, ${type}) ON CONFLICT (id) DO NOTHING`;
}

// ── SETTINGS (company identity for client-facing pages/emails) ──
export async function getCompanySettings() {
  const rows = await sql`SELECT company_name, company_address, company_phone FROM settings WHERE id = 1`;
  const s = rows[0] || {};
  return { companyName: s.company_name || "", companyAddress: s.company_address || "", companyPhone: s.company_phone || "" };
}

// ── INVOICE PAY LINKS (one-off online payments against app invoices) ──
export async function initInvoicePayDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS invoice_pay_links (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      public_token TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS invoice_online_payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      installment_id TEXT,
      kind TEXT DEFAULT 'balance',
      amount NUMERIC(10,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      method TEXT DEFAULT '',
      stripe_payment_intent_id TEXT,
      stripe_customer_id TEXT,
      paid_at DATE,
      receipt_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function getOrCreateInvoicePayLink(invoiceId) {
  const existing = await sql`SELECT * FROM invoice_pay_links WHERE invoice_id = ${invoiceId} LIMIT 1`;
  if (existing[0]) return existing[0];
  const rows = await sql`
    INSERT INTO invoice_pay_links (id, invoice_id, public_token) VALUES (${genId()}, ${invoiceId}, ${randomBytes(16).toString("hex")})
    RETURNING *
  `;
  return rows[0];
}

export async function getInvoiceByPayToken(token) {
  const links = await sql`SELECT * FROM invoice_pay_links WHERE public_token = ${token}`;
  const link = links[0];
  if (!link) return null;
  const invoices = await sql`SELECT * FROM invoices WHERE id = ${link.invoice_id}`;
  const inv = invoices[0];
  if (!inv) return null;
  const [items, installments, payments] = await Promise.all([
    sql`SELECT description, qty, rate, amount FROM invoice_items WHERE invoice_id = ${inv.id} ORDER BY sort_order`,
    sql`SELECT id, amount, due_date, status, paid_at, sort_order FROM invoice_installments WHERE invoice_id = ${inv.id} ORDER BY sort_order`,
    sql`SELECT * FROM invoice_online_payments WHERE invoice_id = ${inv.id} ORDER BY created_at DESC`,
  ]);
  return {
    link: { id: link.id, token: link.public_token },
    invoice: {
      id: inv.id, number: inv.number, clientId: inv.client_id, clientName: inv.client_name, clientEmail: inv.client_email,
      dueDate: toISODate(inv.due_date), status: inv.status, total: parseFloat(inv.total), amountPaid: parseFloat(inv.amount_paid),
      deposit: parseFloat(inv.deposit || 0), notes: inv.notes,
      items: items.map(i => ({ description: i.description, qty: parseFloat(i.qty), rate: parseFloat(i.rate), amount: parseFloat(i.amount) })),
      installments: installments.map(i => ({ id: i.id, amount: parseFloat(i.amount), dueDate: toISODate(i.due_date), status: i.status, paidAt: toISODate(i.paid_at) })),
    },
    payments: payments.map(mapOnlinePayment),
  };
}

function mapOnlinePayment(r) {
  return {
    id: r.id, invoiceId: r.invoice_id, installmentId: r.installment_id, kind: r.kind,
    amount: parseFloat(r.amount), status: r.status, method: r.method,
    paidAt: toISODate(r.paid_at), receiptUrl: r.receipt_url, createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  };
}

export async function upsertOnlinePayment(p) {
  await sql`
    INSERT INTO invoice_online_payments (id, invoice_id, installment_id, kind, amount, status, method, stripe_payment_intent_id, stripe_customer_id, paid_at, receipt_url)
    VALUES (${p.id}, ${p.invoiceId}, ${p.installmentId || null}, ${p.kind || "balance"}, ${p.amount}, ${p.status || "processing"}, ${p.method || ""}, ${p.stripePaymentIntentId || null}, ${p.stripeCustomerId || null}, ${p.paidAt || null}, ${p.receiptUrl || null})
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      method = COALESCE(NULLIF(EXCLUDED.method, ''), invoice_online_payments.method),
      stripe_payment_intent_id = COALESCE(EXCLUDED.stripe_payment_intent_id, invoice_online_payments.stripe_payment_intent_id),
      paid_at = COALESCE(EXCLUDED.paid_at, invoice_online_payments.paid_at),
      receipt_url = COALESCE(EXCLUDED.receipt_url, invoice_online_payments.receipt_url),
      updated_at = NOW()
  `;
}

export async function getOnlinePayment(id) {
  const rows = await sql`SELECT * FROM invoice_online_payments WHERE id = ${id}`;
  return rows[0] ? mapOnlinePayment(rows[0]) : null;
}

export async function listOnlinePaymentsByInvoice() {
  const rows = await sql`SELECT * FROM invoice_online_payments WHERE status IN ('processing', 'paid') ORDER BY created_at DESC`;
  const byInvoice = {};
  for (const r of rows) { (byInvoice[r.invoice_id] ||= []).push(mapOnlinePayment(r)); }
  return byInvoice;
}

// Re-apply confirmed online payments and invoice-linked ledger deposits to invoices,
// so a stale client-side save can never undo them.
export async function reconcileOnlinePayments(invoiceId = null) {
  await sql`
    UPDATE invoice_installments s SET status = 'paid', paid_at = COALESCE(s.paid_at, p.paid_at)
    FROM invoice_online_payments p
    WHERE p.installment_id = s.id AND p.status = 'paid' AND (${invoiceId}::text IS NULL OR p.invoice_id = ${invoiceId})
  `;
  await sql`
    UPDATE invoices i SET
      amount_paid = GREATEST(i.amount_paid, agg.paid),
      status = CASE
        WHEN GREATEST(i.amount_paid, agg.paid) >= i.total THEN 'paid'
        WHEN i.status IN ('paid', 'partial') THEN 'partial'
        WHEN GREATEST(i.amount_paid, agg.paid) > 0 THEN 'partial'
        ELSE i.status END,
      paid_at = CASE
        WHEN agg.paid >= i.total THEN agg.last_paid
        WHEN GREATEST(i.amount_paid, agg.paid) >= i.total THEN COALESCE(i.paid_at, agg.last_paid)
        ELSE i.paid_at END
    FROM (
      SELECT x.invoice_id, SUM(x.amount) AS paid, MAX(x.paid_at) AS last_paid
      FROM (
        SELECT p.invoice_id, p.amount, p.paid_at FROM invoice_online_payments p WHERE p.status = 'paid'
        UNION ALL
        SELECT t.invoice_id, t.amount, t.date AS paid_at FROM bk_transactions t WHERE t.invoice_id IS NOT NULL AND t.amount > 0
      ) x
      WHERE (${invoiceId}::text IS NULL OR x.invoice_id = ${invoiceId})
      GROUP BY x.invoice_id
    ) agg
    WHERE i.id = agg.invoice_id
  `;
}
