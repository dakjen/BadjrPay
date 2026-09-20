import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { sendMail, mailProvider } from "@/lib/email";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mailProvider()) return NextResponse.json({ error: "No email provider configured (BREVO_API_KEY or SENDGRID_API_KEY)" }, { status: 500 });

  const { recipientEmail, recipientName, templateId, templateData, pdfBase64, filename, subject, htmlBody } = await req.json();
  const attachments = pdfBase64 && filename ? [{ content: pdfBase64, filename, type: "application/pdf", disposition: "attachment" }] : undefined;
  try {
    const result = await sendMail({ to: recipientEmail, toName: recipientName, subject: subject || "Invoice", html: htmlBody, attachments, templateId, templateData });
    return NextResponse.json({ success: true, provider: result.provider, sgStatus: result.status });
  } catch (e) {
    const m = /^(?:Brevo|SendGrid) (\d{3}): (.*)$/s.exec(e.message || "");
    const status = m ? parseInt(m[1]) : 502;
    return NextResponse.json({ error: m ? m[2] : e.message, sgStatus: status }, { status });
  }
}
