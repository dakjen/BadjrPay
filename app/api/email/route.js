import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { sendMail, mailProvider } from "@/lib/email";
import { initDb } from "@/lib/db";
import { getAttachment } from "@/lib/billing-db";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mailProvider()) return NextResponse.json({ error: "No email provider configured (BREVO_API_KEY or SENDGRID_API_KEY)" }, { status: 500 });

  const { recipientEmail, recipientName, templateId, templateData, pdfBase64, filename, subject, htmlBody, attachmentIds } = await req.json();
  const attachments = pdfBase64 && filename ? [{ content: pdfBase64, filename, type: "application/pdf", disposition: "attachment" }] : [];
  // Stored documents (contracts, proposals) chosen in the app ride along with the invoice
  if (Array.isArray(attachmentIds) && attachmentIds.length) {
    await initDb();
    for (const id of attachmentIds.slice(0, 10)) {
      const a = await getAttachment(id);
      if (!a) continue;
      try {
        const buf = Buffer.from(await (await fetch(a.url)).arrayBuffer());
        if (buf.length > 15 * 1024 * 1024) continue; // provider limits
        attachments.push({ content: buf.toString("base64"), filename: a.filename, type: a.contentType || "application/octet-stream", disposition: "attachment" });
      } catch (e) { console.error("attachment fetch failed", a.filename, e.message); }
    }
  }
  try {
    const result = await sendMail({ to: recipientEmail, toName: recipientName, subject: subject || "Invoice", html: htmlBody, attachments: attachments.length ? attachments : undefined, templateId, templateData });
    return NextResponse.json({ success: true, provider: result.provider, sgStatus: result.status });
  } catch (e) {
    const m = /^(?:Brevo|SendGrid) (\d{3}): (.*)$/s.exec(e.message || "");
    const status = m ? parseInt(m[1]) : 502;
    return NextResponse.json({ error: m ? m[2] : e.message, sgStatus: status }, { status });
  }
}
