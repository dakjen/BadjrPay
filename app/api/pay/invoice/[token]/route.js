import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { isStripeConfigured, getBaseUrl } from "@/lib/stripe";
import { createInvoiceCheckout } from "@/lib/billing";

// Public: the client chose an amount on /pay/invoice/[token] → send them to Stripe Checkout.
export async function POST(req, { params }) {
  const { token } = await params;
  const baseUrl = getBaseUrl(req);
  const back = (q) => NextResponse.redirect(`${baseUrl}/pay/invoice/${token}${q ? `?${q}` : ""}`, 303);
  try {
    if (!isStripeConfigured()) return back("error=unavailable");
    await initDb();
    const form = await req.formData();
    const kind = String(form.get("kind") || "balance");
    const session = await createInvoiceCheckout(token, kind, baseUrl);
    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    console.error("Invoice checkout error:", e);
    return back(e.message === "Payment link not found" ? "error=notfound" : "error=checkout");
  }
}
