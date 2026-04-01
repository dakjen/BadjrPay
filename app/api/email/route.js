import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "SENDGRID_API_KEY not configured" }, { status: 500 });

  const { senderEmail, senderName, recipientEmail, recipientName, templateId, templateData, pdfBase64, filename } = await req.json();

  const payload = {
    personalizations: [{ to: [{ email: recipientEmail, name: recipientName || "" }], dynamic_template_data: templateData || {} }],
    from: { email: senderEmail, name: senderName || senderEmail },
    template_id: templateId,
  };

  if (pdfBase64 && filename) {
    payload.attachments = [{ content: pdfBase64, filename, type: "application/pdf", disposition: "attachment" }];
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.ok || res.status === 202) return NextResponse.json({ success: true });
  const err = await res.text();
  return NextResponse.json({ error: err }, { status: res.status });
}
