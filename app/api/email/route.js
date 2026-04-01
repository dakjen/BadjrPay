import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "SENDGRID_API_KEY not configured" }, { status: 500 });

  const { recipientEmail, recipientName, templateId, templateData, pdfBase64, filename, subject, htmlBody } = await req.json();
  const senderEmail = process.env.SENDER_EMAIL;
  const senderName = process.env.SENDER_NAME || senderEmail;
  if (!senderEmail) return NextResponse.json({ error: "SENDER_EMAIL not configured" }, { status: 500 });

  const payload = templateId
    ? {
        personalizations: [{ to: [{ email: recipientEmail, name: recipientName || "" }], dynamic_template_data: templateData || {} }],
        from: { email: senderEmail, name: senderName || senderEmail },
        template_id: templateId,
      }
    : {
        personalizations: [{ to: [{ email: recipientEmail, name: recipientName || "" }] }],
        from: { email: senderEmail, name: senderName || senderEmail },
        subject: subject || "Invoice",
        content: [{ type: "text/html", value: htmlBody || "" }],
      };

  if (pdfBase64 && filename) {
    payload.attachments = [{ content: pdfBase64, filename, type: "application/pdf", disposition: "attachment" }];
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const responseText = await res.text();
  if (res.ok || res.status === 202) return NextResponse.json({ success: true, sgStatus: res.status });
  return NextResponse.json({ error: responseText, sgStatus: res.status }, { status: res.status });
}
