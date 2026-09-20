import { escHtml } from "./email";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const fmtDate = (iso) => { if (!iso) return "—"; const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); };
const row = (k, v, strong) => `<tr><td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">${escHtml(k)}</td><td align="right" style="font-size:13px;color:#363636;font-weight:${strong ? 700 : 500};padding:8px 0;border-bottom:1px solid #f2f2f2;">${v}</td></tr>`;
const button = (href, label) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 8px;"><tr><td align="center"><a href="${escHtml(href)}" style="display:inline-block;background-color:#476C2E;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;">${escHtml(label)}</a></td></tr></table>`;

// Client-facing shell — same look as the invoice email
function clientShell({ badge, title, greeting, intro, rows, after, sender }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#fffcf0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fffcf0;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2DDD3;">
  <tr><td style="background-color:#F7F5F0;border-bottom:3px solid #0B2D65;padding:20px 32px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
    <td><img src="https://badjr-pay.vercel.app/CLEARGREEN-BADJR.png" alt="BaDjR" width="150" height="76" style="display:block;border:0;" /></td>
    <td align="right"><span style="font-size:11px;font-weight:600;color:#0b2d65;background-color:rgba(11,45,101,0.12);padding:4px 12px;border-radius:20px;letter-spacing:0.08em;text-transform:uppercase;">${escHtml(badge)}</span></td>
  </tr></table></td></tr>
  <tr><td style="padding:32px 32px 24px;">
    <p style="margin:0 0 8px;font-size:15px;color:#363636;line-height:1.6;">Hi <strong>${escHtml(greeting)}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#363636;line-height:1.6;">${intro}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows.join("")}</table>
    ${after || ""}
  </td></tr>
  <tr><td style="background-color:#fffcf0;border-top:1px solid #e9e9e9;padding:16px 32px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="font-size:13px;color:#476c2e;font-weight:600;">${escHtml(sender)}</td><td align="right" style="font-size:11px;color:#888888;">badjrtech.com</td></tr></table></td></tr>
</table></td></tr></table></body></html>`;
}

export function buildReceiptEmail({ invoice, amount, method, remaining, companyName, receiptUrl, paidAt }) {
  const sender = companyName || "BaDjR Tech";
  const settled = remaining <= 0.005;
  return clientShell({
    badge: settled ? "Paid in full" : "Payment received", title: `Payment received — Invoice ${invoice.number}`, greeting: invoice.clientName || "there",
    intro: `Thank you — we received your payment${method ? ` by ${escHtml(method)}` : ""} toward <strong>Invoice ${escHtml(invoice.number)}</strong> from <strong>${escHtml(sender)}</strong>.`,
    rows: [row("Invoice #", escHtml(invoice.number)), row("Payment", fmt(amount), true), row("Date", fmtDate(paidAt)), row("Invoice total", fmt(invoice.total)), row(settled ? "Balance" : "Remaining balance", settled ? "Paid in full ✓" : fmt(remaining), !settled)],
    after: (receiptUrl ? `<p style="margin:20px 0 0;font-size:13px;color:#888888;">Card/bank receipt from Stripe: <a href="${escHtml(receiptUrl)}" style="color:#476C2E;">view receipt</a></p>` : "") + `<p style="margin:20px 0 0;font-size:14px;color:#363636;line-height:1.6;">${settled ? "This invoice is now fully paid. Thanks for working with us!" : "The remaining balance is due by the original due date."}</p>`,
    sender,
  });
}

export function buildReminderEmail({ invoice, kind, payUrl, companyName }) {
  const sender = companyName || "BaDjR Tech";
  const balance = (invoice.total || 0) - (invoice.amountPaid || 0);
  const copy = {
    due_soon: { badge: "Due soon", intro: `A friendly reminder that <strong>Invoice ${escHtml(invoice.number)}</strong> from <strong>${escHtml(sender)}</strong> is due on <strong>${fmtDate(invoice.dueDate)}</strong>.` },
    due_today: { badge: "Due today", intro: `<strong>Invoice ${escHtml(invoice.number)}</strong> from <strong>${escHtml(sender)}</strong> is due today.` },
    overdue: { badge: "Past due", intro: `<strong>Invoice ${escHtml(invoice.number)}</strong> from <strong>${escHtml(sender)}</strong> was due on <strong>${fmtDate(invoice.dueDate)}</strong> and is still open. If you've already sent payment, thank you — please disregard this note.` },
  }[kind] || {};
  return clientShell({
    badge: copy.badge || "Reminder", title: `Reminder — Invoice ${invoice.number}`, greeting: invoice.clientName || "there", intro: copy.intro,
    rows: [row("Invoice #", escHtml(invoice.number)), row("Amount due", fmt(balance), true), row("Due date", fmtDate(invoice.dueDate))],
    after: payUrl ? button(payUrl, "Pay online") + `<p style="margin:0;font-size:12px;color:#888888;text-align:center;">Bank account (ACH) or card, through Stripe's secure checkout.</p>` : "",
    sender,
  });
}

export function buildInstallmentReminderEmail({ invoice, installment, payUrl, companyName }) {
  const sender = companyName || "BaDjR Tech";
  return clientShell({
    badge: "Payment plan", title: `Upcoming payment — Invoice ${invoice.number}`, greeting: invoice.clientName || "there",
    intro: `Your next scheduled payment on <strong>Invoice ${escHtml(invoice.number)}</strong> from <strong>${escHtml(sender)}</strong> is coming up.`,
    rows: [row("Invoice #", escHtml(invoice.number)), row("Installment", fmt(installment.amount), true), row("Due", fmtDate(installment.dueDate)), row("Remaining after this payment", fmt(Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0) - installment.amount)))],
    after: payUrl ? button(payUrl, "Pay this installment") : "",
    sender,
  });
}

export function buildPlanActivatedEmail({ sub, companyName }) {
  const sender = companyName || "BaDjR Tech";
  return clientShell({
    badge: "Plan active", title: `Your ${sub.name} is set up`, greeting: sub.clientName || "there",
    intro: `Your recurring plan with <strong>${escHtml(sender)}</strong> is active. Payments run automatically, and you'll get a receipt each time.`,
    rows: [row("Plan", escHtml(sub.name)), row("Amount", `${fmt(sub.amount)} · ${escHtml(sub.cadence || "")}`, true), row(sub.status === "trialing" ? "First charge" : "Next charge", fmtDate(sub.currentPeriodEnd))],
    after: `<p style="margin:20px 0 0;font-size:13px;color:#888888;">Need to change your payment method or cancel? Reply to this email and we'll take care of it.</p>`,
    sender,
  });
}

export function buildPlanFailedEmail({ sub, companyName, portalUrl }) {
  const sender = companyName || "BaDjR Tech";
  return clientShell({
    badge: "Action needed", title: `Payment didn't go through — ${sub.name}`, greeting: sub.clientName || "there",
    intro: `The latest payment for your <strong>${escHtml(sub.name)}</strong> plan with <strong>${escHtml(sender)}</strong> didn't go through. This usually means an expired card or a bank rejection. Stripe will retry automatically over the next few days.`,
    rows: [row("Plan", escHtml(sub.name)), row("Amount", fmt(sub.amount), true)],
    after: portalUrl ? button(portalUrl, "Update payment method") : `<p style="margin:20px 0 0;font-size:14px;color:#363636;">Reply to this email and we'll send a secure link to update your payment details.</p>`,
    sender,
  });
}

// ── Owner-facing (plain, compact) ──
function ownerShell(title, body) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F7F5F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1A1A;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E2DDD3;border-radius:12px;overflow:hidden;">
    <div style="background:#476C2E;color:#fff;padding:14px 20px;font-weight:700;">Badjr-Pay</div>
    <div style="padding:20px;font-size:14px;line-height:1.6;"><h2 style="margin:0 0 12px;font-size:18px;">${escHtml(title)}</h2>${body}</div>
  </div></body></html>`;
}
export function buildOwnerAlert({ title, lines, link, linkLabel }) {
  return ownerShell(title, `<ul style="margin:0 0 16px;padding-left:18px;">${lines.map(l => `<li>${l}</li>`).join("")}</ul>${link ? `<a href="${escHtml(link)}" style="color:#476C2E;font-weight:600;">${escHtml(linkLabel || "Open Badjr-Pay")} →</a>` : ""}`);
}
export function buildOwnerDigest({ weekLabel, overdue, dueThisWeek, expected30, mrr, renewals, link }) {
  const list = (items, empty) => items.length ? `<ul style="margin:0 0 6px;padding-left:18px;">${items.map(i => `<li>${i}</li>`).join("")}</ul>` : `<p style="margin:0 0 6px;color:#9C9590;">${escHtml(empty)}</p>`;
  return ownerShell(`Week of ${weekLabel}`, `
    <p style="margin:0 0 14px;"><b>${fmt(expected30)}</b> expected in the next 30 days · <b>${fmt(mrr)}</b> MRR</p>
    <h3 style="margin:14px 0 6px;font-size:14px;color:#8A1C1C;">Overdue (${overdue.length})</h3>${list(overdue, "Nothing overdue — nice.")}
    <h3 style="margin:14px 0 6px;font-size:14px;color:#B8811A;">Due this week (${dueThisWeek.length})</h3>${list(dueThisWeek, "Nothing due this week.")}
    ${renewals.length ? `<h3 style="margin:14px 0 6px;font-size:14px;color:#0B2D65;">Renewals coming up</h3>${list(renewals, "")}` : ""}
    <p style="margin:16px 0 0;"><a href="${escHtml(link)}" style="color:#476C2E;font-weight:600;">Open Badjr-Pay →</a></p>`);
}
