// Server-side SendGrid helper (shared by /api/email and billing emails)
export async function sendMail({ to, toName, subject, html, attachments }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL;
  const senderName = process.env.SENDER_NAME || senderEmail;
  if (!apiKey) throw new Error("SENDGRID_API_KEY not configured");
  if (!senderEmail) throw new Error("SENDER_EMAIL not configured");
  if (!to) throw new Error("Recipient email is required");

  const payload = {
    personalizations: [{ to: [{ email: to, name: toName || "" }] }],
    from: { email: senderEmail, name: senderName },
    subject,
    content: [{ type: "text/html", value: html }],
  };
  if (attachments?.length) payload.attachments = attachments;

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 202) {
    const text = await res.text();
    throw new Error(`SendGrid ${res.status}: ${text.slice(0, 300)}`);
  }
  return true;
}

export function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
