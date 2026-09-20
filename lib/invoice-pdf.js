import { jsPDF } from "jspdf";

// Draws the invoice PDF. Shared by the browser (download / email) and the server (auto-issued renewals, reminders).
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const fmtDate = (d) => { if (!d) return "—"; try { const s = String(d).trim(); const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date(s).toISOString().split("T")[0]; const [y, m, day] = iso.split("-"); return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return "—"; } };

export function drawInvoicePDF(invoice, settings, client) {
  const doc = new jsPDF();
  const W = 210, margin = 20, cW = W - margin * 2;
  let y = 20;
  const A = [45, 90, 61], D = [26, 26, 26], G = [107, 101, 96], L = [237, 233, 225];

  // Header bar
  doc.setFillColor(...A);
  doc.rect(0, 0, W, 44, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text(settings.companyName || "INVOICE", margin, 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  if (settings.companyAddress) doc.text(settings.companyAddress, margin, 28);
  if (settings.companyPhone) doc.text(settings.companyPhone, margin, 34);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(invoice.number || "INV-0001", W - margin, 20, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Issued: ${invoice.createdAt ? fmtDate(invoice.createdAt) : "-"}`, W - margin, 28, { align: "right" });
  doc.text(`Due: ${invoice.dueDate ? fmtDate(invoice.dueDate) : "-"}`, W - margin, 34, { align: "right" });
  if (invoice.status === "paid") doc.text(`Paid: ${invoice.paidAt ? fmtDate(invoice.paidAt) : "Yes"}`, W - margin, 40, { align: "right" });

  y = 58;
  doc.setTextColor(...G); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("BILL TO", margin, y); y += 6;
  doc.setTextColor(...D); doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text(invoice.clientName || "-", margin, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...G);
  if (client?.email) { doc.text(client.email, margin, y); y += 4.5; }
  if (client?.phone) { doc.text(client.phone, margin, y); y += 4.5; }
  if (client?.address) { client.address.split("\n").forEach(l => { doc.text(l.trim(), margin, y); y += 4.5; }); }

  y += 8;
  // Table header
  doc.setFillColor(...L); doc.rect(margin, y, cW, 8, "F");
  doc.setTextColor(...G); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", margin + 3, y + 5.5);
  doc.text("QTY", margin + cW * 0.58, y + 5.5);
  doc.text("RATE", margin + cW * 0.72, y + 5.5);
  doc.text("AMOUNT", margin + cW - 3, y + 5.5, { align: "right" });
  y += 12;

  // Line items
  doc.setTextColor(...D); doc.setFontSize(9.5); doc.setFont("helvetica", "normal");
  (invoice.items || []).forEach(li => {
    if (y > 260) { doc.addPage(); y = 20; }
    const t = (parseFloat(li.qty) || 0) * (parseFloat(li.rate) || 0);
    const desc = doc.splitTextToSize(li.description || "", cW * 0.54);
    doc.text(desc, margin + 3, y);
    doc.text(String(li.qty || 0), margin + cW * 0.58, y);
    doc.text(fmt(li.rate || 0), margin + cW * 0.72, y);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(t), margin + cW - 3, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    // Separator sits just under this row's last text line (baseline + descender), never through the next row
    const bottom = y + (desc.length - 1) * 4.5 + 2.8;
    doc.setDrawColor(...L); doc.line(margin, bottom, margin + cW, bottom);
    y += Math.max(desc.length * 4.5, 7) + 1.5;
  });

  y += 8;
  const tX = margin + cW * 0.58;
  const deposit = parseFloat(invoice.deposit || 0);
  const remaining = (invoice.total || 0) - (invoice.amountPaid || 0);
  doc.setTextColor(...G); doc.setFontSize(9.5);
  doc.text("Subtotal", tX, y);
  doc.setTextColor(...D); doc.text(fmt(invoice.total || 0), margin + cW - 3, y, { align: "right" });
  y += 6;
  if (deposit > 0) {
    doc.setTextColor(...G);
    doc.text("Deposit (due on receipt)", tX, y);
    doc.setTextColor(...D); doc.text(`+${fmt(deposit)}`, margin + cW - 3, y, { align: "right" });
    y += 6;
  }
  if ((invoice.amountPaid || 0) > 0) {
    doc.setTextColor(45, 122, 79);
    doc.text("Amount Paid", tX, y);
    doc.text(`-${fmt(invoice.amountPaid)}`, margin + cW - 3, y, { align: "right" });
    y += 6;
  }
  doc.setDrawColor(...D); doc.setLineWidth(0.5); doc.line(tX, y - 1, margin + cW, y - 1);
  y += 5;
  doc.setTextColor(...D); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("TOTAL DUE", tX, y);
  doc.text(fmt(remaining), margin + cW - 3, y, { align: "right" });
  y += 14;

  // Payment terms
  const hasInstallments = (invoice.installments || []).length > 0;
  const paymentTermsLines = [];
  if (deposit > 0) {
    paymentTermsLines.push(`A deposit of ${fmt(deposit)} is due upon receipt.`);
  }
  if (hasInstallments) {
    const pendingInst = (invoice.installments || []).filter(i => i.status !== "paid");
    if (pendingInst.length > 0) {
      paymentTermsLines.push(`Invoice total of ${fmt(invoice.total || 0)} is payable in ${(invoice.installments || []).length} installments.`);
    }
  } else if (invoice.dueDate) {
    paymentTermsLines.push(`Invoice total of ${fmt(invoice.total || 0)} is due by ${fmtDate(invoice.dueDate)}.`);
  }
  if (paymentTermsLines.length > 0) {
    doc.setFillColor(240, 248, 243);
    const termsH = 10 + paymentTermsLines.length * 5.5;
    doc.roundedRect(margin, y, cW, termsH, 2, 2, "F");
    doc.setTextColor(45, 90, 61); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    doc.text("PAYMENT TERMS", margin + 4, y + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...D);
    paymentTermsLines.forEach((line, idx) => { doc.text(line, margin + 4, y + 11 + idx * 5.5); });
    y += termsH + 6;
  }

  if (invoice.notes) {
    doc.setFillColor(247, 245, 240);
    const noteLines = doc.splitTextToSize(invoice.notes, cW - 8);
    const boxH = 14 + noteLines.length * 4;
    doc.roundedRect(margin, y, cW, boxH, 2, 2, "F");
    doc.setTextColor(...G); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    doc.text("NOTES", margin + 4, y + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...D);
    doc.text(noteLines, margin + 4, y + 11);
  }

  // Paid stamp
  if (invoice.status === "paid") {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.15 }));
    doc.setTextColor(45, 122, 79); doc.setFontSize(48); doc.setFont("helvetica", "bold");
    doc.text("PAID", W / 2, 150, { align: "center", angle: 25 });
    doc.restoreGraphicsState();
  }

  // Footer
  doc.setTextColor(...G); doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.text("Thank you for your business.", W / 2, 282, { align: "center" });

  return doc;
}

export function invoicePdfFilename(invoice) {
  return `${(invoice.number || "invoice").replace(/\s/g, "_")}.pdf`;
}

// Server-side: base64 for an email attachment
export function invoicePdfBase64(invoice, settings, client) {
  const doc = drawInvoicePDF(invoice, settings, client);
  return doc.output("datauristring").split(",")[1];
}
