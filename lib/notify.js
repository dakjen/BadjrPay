import { sendMail, mailProvider } from "./email";
import { listUsers } from "./db";
import { getCompanySettings, getInvoiceById, getOrCreateInvoicePayLink, listOpenInvoices, listRecurringInvoices, markInvoiceOverdue, createRenewalInvoice, alreadySent, logSent, listSubscriptions } from "./billing-db";
import { invoicePdfBase64, invoicePdfFilename } from "./invoice-pdf";
import { intervalLabel, isStripeConfigured } from "./stripe";
import { buildReceiptEmail, buildReminderEmail, buildInstallmentReminderEmail, buildPlanActivatedEmail, buildPlanFailedEmail, buildOwnerAlert, buildOwnerDigest } from "./notify-email";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const todayISO = () => new Date().toISOString().split("T")[0];
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().split("T")[0]; };
const addMonths = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1 + n, d)); return dt.toISOString().split("T")[0]; };
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
const RECUR_MONTHS = { month: 1, quarter: 3, year: 12 };

async function safe(label, fn) { try { return await fn(); } catch (e) { console.error(`[notify] ${label}:`, e.message); return null; } }

async function pdfAttachment(invoice, settings) {
  try {
    return [{ content: invoicePdfBase64(invoice, settings, { email: invoice.clientEmail, phone: invoice.clientPhone, address: invoice.clientAddress }), filename: invoicePdfFilename(invoice), type: "application/pdf", disposition: "attachment" }];
  } catch (e) { console.error("[notify] pdf failed:", e.message); return undefined; }
}

export async function notifyOwners({ subject, title, lines, link, linkLabel }) {
  if (!mailProvider()) return;
  const owners = (await listUsers()).filter(u => u.role === "owner" && u.email);
  const html = buildOwnerAlert({ title, lines, link, linkLabel });
  for (const o of owners) await safe(`owner mail → ${o.email}`, () => sendMail({ to: o.email, toName: o.name, subject, html }));
}

// Money landed on an invoice (online payment, or "Send receipt" from the app)
export async function sendReceipt({ invoiceId, amount, method, receiptUrl, paidAt, baseUrl }) {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return;
  const { companyName } = await getCompanySettings();
  const remaining = Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0));
  const methodLabel = method === "ach" ? "bank transfer (ACH)" : method === "card" ? "card" : method || "";
  if (invoice.clientEmail && mailProvider()) {
    await safe("receipt", () => sendMail({
      to: invoice.clientEmail, toName: invoice.clientName,
      subject: `Payment received — Invoice ${invoice.number}${remaining <= 0.005 ? " (paid in full)" : ""}`,
      html: buildReceiptEmail({ invoice, amount, method: methodLabel, remaining, companyName, receiptUrl, paidAt: paidAt || todayISO() }),
    }));
  }
  await notifyOwners({
    subject: `💸 ${fmt(amount)} received — ${invoice.number} · ${invoice.clientName}`,
    title: `${invoice.clientName || "A client"} paid ${fmt(amount)}`,
    lines: [`Invoice <b>${invoice.number}</b>${methodLabel ? ` via ${methodLabel}` : ""}`, remaining <= 0.005 ? "Invoice is now <b>paid in full</b>." : `Remaining balance: <b>${fmt(remaining)}</b>`],
    link: baseUrl ? `${baseUrl}/#invoices` : undefined, linkLabel: "Open invoices",
  });
}

export async function sendPlanActivated(sub, baseUrl) {
  const { companyName } = await getCompanySettings();
  const cadence = intervalLabel(sub.interval, sub.intervalCount);
  if (sub.clientEmail && mailProvider()) {
    await safe("plan activated", () => sendMail({ to: sub.clientEmail, toName: sub.clientName, subject: `Your ${sub.name} with ${companyName || "BaDjR Tech"} is active`, html: buildPlanActivatedEmail({ sub: { ...sub, cadence }, companyName }) }));
  }
  await notifyOwners({ subject: `🔁 ${sub.clientName || "A client"} activated ${sub.name}`, title: `${sub.clientName || "A client"} set up a recurring plan`, lines: [`<b>${sub.name}</b> — ${fmt(sub.amount)} ${cadence.toLowerCase()}`, sub.currentPeriodEnd ? `Next charge ${sub.currentPeriodEnd}` : ""].filter(Boolean), link: baseUrl ? `${baseUrl}/#billing` : undefined, linkLabel: "Open Billing" });
}

export async function sendPlanFailed(sub, portalUrl, baseUrl) {
  const { companyName } = await getCompanySettings();
  if (sub.clientEmail && mailProvider()) {
    await safe("plan failed", () => sendMail({ to: sub.clientEmail, toName: sub.clientName, subject: `Action needed: payment for ${sub.name} didn't go through`, html: buildPlanFailedEmail({ sub, companyName, portalUrl }) }));
  }
  await notifyOwners({ subject: `⚠️ Payment failed — ${sub.clientName || "client"} · ${sub.name}`, title: "A recurring payment failed", lines: [`<b>${sub.clientName || "Client"}</b> — ${sub.name}, ${fmt(sub.amount)}`, "Stripe will retry automatically; the client was asked to update their payment method."], link: baseUrl ? `${baseUrl}/#billing` : undefined, linkLabel: "Open Billing" });
}

export async function sendRecurringPaymentAlert({ clientName, description, amount, baseUrl }) {
  await notifyOwners({ subject: `💸 ${fmt(amount)} recurring payment — ${clientName || "client"}`, title: `Recurring payment received`, lines: [`<b>${clientName || "Client"}</b> — ${description || "subscription"}: <b>${fmt(amount)}</b>`, "Posted to the ledger as Revenue."], link: baseUrl ? `${baseUrl}/#billing` : undefined, linkLabel: "Open Billing" });
}

// ── DAILY JOB ── reminders, auto-renewals, overdue flags, Monday digest
export async function runDaily(baseUrl, { dryRun = false } = {}) {
  const today = todayISO();
  const { companyName } = await getCompanySettings();
  const settings = await getCompanySettings();
  const stripeOn = isStripeConfigured();
  const out = { dryRun, reminders: 0, installmentReminders: 0, renewalsIssued: 0, markedOverdue: 0, digest: false, skipped: 0, planned: [] };
  const plan = (what) => out.planned.push(what);
  if (!mailProvider()) return { ...out, error: "No email provider configured" };
  const clientMail = settings.autoReminders !== false; // Settings → Automatic Emails switch
  out.clientEmailsEnabled = clientMail;

  const payLinkFor = async (inv) => stripeOn ? `${baseUrl}/pay/invoice/${(await getOrCreateInvoicePayLink(inv.id)).public_token}` : null;

  // 1. Invoice reminders
  for (const inv of await listOpenInvoices()) {
    if (!inv.dueDate) continue;
    const days = daysBetween(inv.dueDate, today); // positive = overdue
    if (days > 0) { if (!dryRun) await markInvoiceOverdue(inv.id); out.markedOverdue++; }
    let kind = null, key = null;
    if (days === -3) { kind = "due_soon"; key = "due_soon"; }
    else if (days === 0) { kind = "due_today"; key = "due_today"; }
    else if (days >= 30) { kind = "overdue"; key = "overdue_30"; }
    else if (days >= 14) { kind = "overdue"; key = "overdue_14"; }
    else if (days >= 7) { kind = "overdue"; key = "overdue_7"; }
    if (clientMail && kind && inv.clientEmail && !(await alreadySent(`invoice:${inv.id}`, key))) {
      if (dryRun) { plan(`${kind.replace("_", " ")} reminder → ${inv.clientEmail} for ${inv.number} (${fmt(inv.total - inv.amountPaid)})`); out.reminders++; continue; }
      const ok = await safe(`reminder ${inv.number}`, async () => sendMail({
        to: inv.clientEmail, toName: inv.clientName,
        subject: kind === "overdue" ? `Past due: Invoice ${inv.number} from ${companyName || "BaDjR Tech"}` : kind === "due_today" ? `Due today: Invoice ${inv.number} from ${companyName || "BaDjR Tech"}` : `Reminder: Invoice ${inv.number} is due ${inv.dueDate}`,
        html: buildReminderEmail({ invoice: inv, kind, payUrl: await payLinkFor(inv), companyName }),
        attachments: await pdfAttachment(inv, settings),
      }));
      if (ok) { await logSent(`invoice:${inv.id}`, key); out.reminders++; } else out.skipped++;
    }
    // Payment-plan installments due in 3 days
    for (const inst of (inv.installments || []).filter(x => x.status !== "paid" && x.dueDate)) {
      if (!clientMail || daysBetween(inst.dueDate, today) !== -3 || !inv.clientEmail) continue;
      const k = `inst:${inst.id}`;
      if (await alreadySent(`invoice:${inv.id}`, k)) continue;
      if (dryRun) { plan(`installment reminder → ${inv.clientEmail} for ${inv.number} (${fmt(inst.amount)} due ${inst.dueDate})`); out.installmentReminders++; continue; }
      const ok = await safe(`installment ${inv.number}`, async () => sendMail({ to: inv.clientEmail, toName: inv.clientName, subject: `Upcoming payment: ${fmt(inst.amount)} due ${inst.dueDate} — Invoice ${inv.number}`, html: buildInstallmentReminderEmail({ invoice: inv, installment: inst, payUrl: await payLinkFor(inv), companyName }) }));
      if (ok) { await logSent(`invoice:${inv.id}`, k); out.installmentReminders++; }
    }
  }

  // 2. Recurring invoices: re-issue 15 days before renewal, due on the renewal date
  for (const inv of await listRecurringInvoices()) {
    const months = RECUR_MONTHS[inv.recurring];
    if (!clientMail || !months || !inv.recurringNext || daysBetween(today, inv.recurringNext) > 15) continue;
    const key = `renewal:${inv.recurringNext}`;
    if (await alreadySent(`invoice:${inv.id}`, key)) continue;
    if (dryRun) { plan(`issue renewal of ${inv.number} (${fmt(inv.total)}) due ${inv.recurringNext}${inv.clientEmail ? ` → ${inv.clientEmail}` : ""}`); out.renewalsIssued++; continue; }
    const renewal = await createRenewalInvoice(inv, { dueDate: inv.recurringNext, recurringNext: addMonths(inv.recurringNext, months) });
    await logSent(`invoice:${inv.id}`, key);
    out.renewalsIssued++;
    if (renewal.clientEmail) {
      await safe(`renewal ${renewal.number}`, async () => sendMail({
        to: renewal.clientEmail, toName: renewal.clientName,
        subject: `Invoice #${renewal.number} from ${companyName || "BaDjR Tech"} — ${intervalLabelForInvoice(inv.recurring)} renewal`,
        html: buildReminderEmail({ invoice: renewal, kind: "due_soon", payUrl: await payLinkFor(renewal), companyName }),
        attachments: await pdfAttachment(renewal, settings),
      }));
    }
    await notifyOwners({ subject: `🔁 Renewal issued: ${renewal.number} · ${renewal.clientName}`, title: `Renewal invoice ${renewal.number} was issued`, lines: [`Continues <b>${inv.number}</b> (${intervalLabelForInvoice(inv.recurring)}) — <b>${fmt(renewal.total)}</b> due ${renewal.dueDate}`, renewal.clientEmail ? `Emailed to ${renewal.clientEmail} with the PDF and a pay link.` : "Client has no email on file — send it manually."], link: `${baseUrl}/#invoices`, linkLabel: "Open invoices" });
  }

  // 3. Monday digest for owners
  if (new Date(today + "T12:00:00Z").getUTCDay() === 1 && !(await alreadySent("digest", today))) {
    if (dryRun) { plan("Monday digest → owners"); out.digest = true; return out; }
    const open = await listOpenInvoices();
    const overdue = open.filter(i => i.dueDate && i.dueDate < today).map(i => `<b>${i.number}</b> ${i.clientName} — ${fmt(i.total - i.amountPaid)} (due ${i.dueDate})`);
    const weekEnd = addDays(today, 7);
    const dueThisWeek = open.filter(i => i.dueDate && i.dueDate >= today && i.dueDate <= weekEnd).map(i => `<b>${i.number}</b> ${i.clientName} — ${fmt(i.total - i.amountPaid)} (due ${i.dueDate})`);
    const in30 = addDays(today, 30);
    const expected30 = open.filter(i => !i.dueDate || i.dueDate <= in30).reduce((s, i) => s + (i.total - i.amountPaid), 0);
    const plans = (await listSubscriptions()).filter(p => ["active", "trialing", "past_due"].includes(p.status) && !p.cancelAtPeriodEnd);
    const mrr = plans.reduce((s, p) => s + (p.interval === "year" ? p.amount / (12 * (p.intervalCount || 1)) : p.interval === "week" ? p.amount * 52 / 12 : p.amount / (p.intervalCount || 1)), 0)
      + (await listRecurringInvoices()).reduce((s, i) => s + (i.total || 0) / (RECUR_MONTHS[i.recurring] || 12), 0);
    const renewals = (await listRecurringInvoices()).filter(i => i.recurringNext && i.recurringNext <= addDays(today, 45)).map(i => `<b>${i.number}</b> ${i.clientName} — ${fmt(i.total)} renews ${i.recurringNext}`);
    const owners = (await listUsers()).filter(u => u.role === "owner" && u.email);
    const html = buildOwnerDigest({ weekLabel: new Date(today + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric" }), overdue, dueThisWeek, expected30, mrr, renewals, link: `${baseUrl}/#dashboard` });
    for (const o of owners) await safe(`digest → ${o.email}`, () => sendMail({ to: o.email, toName: o.name, subject: `Badjr-Pay weekly: ${overdue.length} overdue · ${fmt(expected30)} expected this month`, html }));
    await logSent("digest", today);
    out.digest = true;
  }
  return out;
}

const intervalLabelForInvoice = (r) => ({ month: "Monthly", quarter: "Quarterly", year: "Annual" }[r] || "Recurring");
