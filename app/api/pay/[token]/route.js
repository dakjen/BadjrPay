import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSubscriptionByToken } from "@/lib/billing-db";
import { isStripeConfigured, getBaseUrl } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/billing";

// Public: the client clicked "Set up payment" on /pay/[token] → send them to Stripe Checkout.
export async function POST(req, { params }) {
  const { token } = await params;
  const baseUrl = getBaseUrl(req);
  const back = (q) => NextResponse.redirect(`${baseUrl}/pay/${token}${q ? `?${q}` : ""}`, 303);
  try {
    await initDb();
    const sub = await getSubscriptionByToken(token);
    if (!sub) return back("error=notfound");
    if (!isStripeConfigured()) return back("error=unavailable");
    if (sub.stripeSubscriptionId && !["canceled", "incomplete_expired"].includes(sub.status)) return back("status=already");
    if (sub.status === "canceled") return back("error=canceled");
    const session = await createCheckoutSession(sub, baseUrl);
    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    console.error("Checkout error:", e);
    return back("error=checkout");
  }
}
