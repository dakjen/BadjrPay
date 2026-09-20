// Server-side mail helper shared by /api/email and billing emails.
// Provider is chosen by env: BREVO_API_KEY → Brevo, else SENDGRID_API_KEY → SendGrid.
export function mailProvider() {
  if (process.env.BREVO_API_KEY) return "brevo";
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  return null;
}

export async function sendMail({ to, toName, subject, html, attachments, templateId, templateData }) {
  const senderEmail = process.env.SENDER_EMAIL;
  const senderName = process.env.SENDER_NAME || senderEmail;
  if (!senderEmail) throw new Error("SENDER_EMAIL not configured");
  if (!to) throw new Error("Recipient email is required");
  const provider = mailProvider();
  if (!provider) throw new Error("No email provider configured — set BREVO_API_KEY or SENDGRID_API_KEY");

  if (provider === "brevo") {
    const payload = {
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to, name: toName || undefined }],
      subject: subject || "Message from " + senderName,
      htmlContent: html || "",
    };
    if (attachments?.length) payload.attachment = attachments.map(a => ({ content: a.content, name: a.filename }));
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { provider, status: res.status };
  }

  const payload = templateId
    ? {
        personalizations: [{ to: [{ email: to, name: toName || "" }], dynamic_template_data: templateData || {} }],
        from: { email: senderEmail, name: senderName },
        template_id: templateId,
      }
    : {
        personalizations: [{ to: [{ email: to, name: toName || "" }] }],
        from: { email: senderEmail, name: senderName },
        subject: subject || "Message from " + senderName,
        content: [{ type: "text/html", value: html || "" }],
      };
  if (attachments?.length) payload.attachments = attachments;
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 202) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { provider, status: res.status };
}

export function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
