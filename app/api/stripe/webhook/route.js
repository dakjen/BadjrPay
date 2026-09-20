import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getStripe, invoiceSubscriptionId } from "@/lib/stripe";
import { hasProcessedEvent, markEventProcessed, getSubscriptionByStripeId, syncSubscriptionState, getIntegrationSetting } from "@/lib/billing-db";
import { handleCheckoutCompleted, handleInvoiceCheckout, applyStripeSubscription, recordPaidInvoice } from "@/lib/billing";
import { sendPlanFailed } from "@/lib/notify";

// Stripe → us. Public route (excluded from auth in middleware); verified by signature instead.
export async function POST(req) {
  await initDb();
  const secret = process.env.STRIPE_WEBHOOK_SECRET || await getIntegrationSetting("stripe_webhook_secret");
  if (!secret) return NextResponse.json({ error: "Stripe webhook isn't set up yet — use “Set up webhook” on the Billing page" }, { status: 500 });

  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    return NextResponse.json({ error: `Invalid signature: ${e.message}` }, { status: 400 });
  }

  try {
    if (await hasProcessedEvent(event.id)) return NextResponse.json({ received: true, duplicate: true });

    const obj = event.data.object;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        if (obj.mode === "subscription") { if (event.type === "checkout.session.completed") await handleCheckoutCompleted(obj); }
        else await handleInvoiceCheckout(obj, event.type);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await applyStripeSubscription(obj);
        break;
      case "invoice.paid":
        await recordPaidInvoice(obj);
        break;
      case "invoice.payment_failed": {
        const sid = invoiceSubscriptionId(obj);
        const local = sid ? await getSubscriptionByStripeId(sid) : null;
        if (local) {
          await syncSubscriptionState(local.id, { status: "past_due" });
          if (obj.attempt_count === 1) await sendPlanFailed(local, null, process.env.APP_URL).catch(e => console.error("[notify]", e.message));
        }
        break;
      }
      default:
        break; // unhandled event types are acknowledged so Stripe stops retrying
    }
    await markEventProcessed(event.id, event.type);
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Stripe webhook error:", event.type, e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
