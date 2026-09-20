import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { isStripeConfigured, getBaseUrl, intervalLabel } from "@/lib/stripe";
import {
  listSubscriptions, listPayments, getSubscription, createSubscription, deleteSubscription,
  markSubscriptionSent, getClientById, getCompanySettings, getOrCreateInvoicePayLink,
} from "@/lib/billing-db";
import { syncFromStripe, cancelStripeSubscription, resumeStripeSubscription, createPortalSession, getRevenueDashboard, ensureStripeCustomer } from "@/lib/billing";
import { sendMail } from "@/lib/email";
import { buildSubscriptionEmailHTML } from "@/lib/billing-email";

const VALID_INTERVALS = { month: [1, 3, 6], year: [1], week: [1] };

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "subscriptions";
  const noStore = { headers: { "Cache-Control": "no-store" } };
  try {
    await initDb();
    if (view === "revenue") {
      if (!isStripeConfigured()) return NextResponse.json({ configured: false }, noStore);
      return NextResponse.json(await getRevenueDashboard(), noStore);
    }
    const [subscriptions, payments] = await Promise.all([listSubscriptions(), listPayments(100)]);
    return NextResponse.json({ configured: isStripeConfigured(), webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET, baseUrl: getBaseUrl(req), subscriptions, payments }, noStore);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function emailPayLink(sub, baseUrl) {
  if (!sub.clientEmail) throw new Error("This client has no email address — add one on the Clients page first");
  const { companyName } = await getCompanySettings();
  const payUrl = `${baseUrl}/pay/${sub.publicToken}`;
  await sendMail({
    to: sub.clientEmail, toName: sub.clientName,
    subject: `Set up your ${sub.name} with ${companyName || "BaDjR Tech"}`,
    html: buildSubscriptionEmailHTML({ sub, companyName, payUrl }),
  });
  await markSubscriptionSent(sub.id);
  return payUrl;
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role || "owner";
  if (role === "accountant") return NextResponse.json({ error: "Read-only access" }, { status: 403 });

  try {
    await initDb();
    const { action, data = {} } = await req.json();
    const baseUrl = getBaseUrl(req);

    switch (action) {
      case "create_subscription": {
        const client = data.clientId ? await getClientById(data.clientId) : null;
        if (!client) return NextResponse.json({ error: "Pick a client first" }, { status: 400 });
        const amount = Math.round(parseFloat(data.amount) * 100) / 100;
        if (!(amount > 0)) return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
        const interval = data.interval || "month";
        const intervalCount = parseInt(data.intervalCount) || 1;
        if (!VALID_INTERVALS[interval]?.includes(intervalCount)) return NextResponse.json({ error: "Unsupported billing interval" }, { status: 400 });
        const name = (data.name || "").trim() || `${intervalLabel(interval, intervalCount)} Maintenance`;
        const sub = await createSubscription({
          clientId: client.id, clientName: client.name, clientEmail: client.email || "",
          stripeCustomerId: client.stripe_customer_id || null,
          name, description: (data.description || "").trim(), amount, interval, intervalCount,
          trialDays: Math.max(0, parseInt(data.trialDays) || 0),
        });
        // Create the Stripe customer up front so the client is linked before they ever pay
        if (isStripeConfigured()) { try { await ensureStripeCustomer(client); } catch (_) {} }
        const payUrl = `${baseUrl}/pay/${sub.publicToken}`;
        let emailed = false, emailError = null;
        if (data.sendEmail) {
          try { await emailPayLink(sub, baseUrl); emailed = true; } catch (e) { emailError = e.message; }
        }
        return NextResponse.json({ ok: true, subscription: await getSubscription(sub.id), payUrl, emailed, emailError });
      }
      case "send_link": {
        const sub = await getSubscription(data.id);
        if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
        const payUrl = await emailPayLink(sub, baseUrl);
        return NextResponse.json({ ok: true, payUrl });
      }
      case "cancel_subscription": {
        const sub = await cancelStripeSubscription(data.id, { atPeriodEnd: data.atPeriodEnd !== false });
        return NextResponse.json({ ok: true, subscription: sub });
      }
      case "resume_subscription": {
        const sub = await resumeStripeSubscription(data.id);
        return NextResponse.json({ ok: true, subscription: sub });
      }
      case "delete_subscription": {
        const sub = await getSubscription(data.id);
        if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
        if (sub.stripeSubscriptionId && !["canceled", "incomplete_expired"].includes(sub.status)) {
          return NextResponse.json({ error: "Cancel the subscription in Stripe before removing it" }, { status: 400 });
        }
        await deleteSubscription(sub.id);
        return NextResponse.json({ ok: true });
      }
      case "invoice_link": {
        if (!data.invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
        const link = await getOrCreateInvoicePayLink(data.invoiceId);
        return NextResponse.json({ ok: true, url: `${baseUrl}/pay/invoice/${link.public_token}`, configured: isStripeConfigured() });
      }
      case "portal_link": {
        const client = await getClientById(data.clientId);
        if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const customerId = await ensureStripeCustomer(client);
        const url = await createPortalSession(customerId, `${baseUrl}/#billing`);
        return NextResponse.json({ ok: true, url });
      }
      case "sync": {
        if (!isStripeConfigured()) return NextResponse.json({ error: "Stripe is not configured" }, { status: 400 });
        const result = await syncFromStripe();
        return NextResponse.json({ ok: true, ...result });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
