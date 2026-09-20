import { escHtml } from "./email";
import { intervalLabel } from "./stripe";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// Email inviting a client to set up their recurring plan (matches the invoice email look).
export function buildSubscriptionEmailHTML({ sub, companyName, payUrl }) {
  const sender = escHtml(companyName || "BaDjR Tech");
  const client = escHtml(sub.clientName || "there");
  const plan = escHtml(sub.name);
  const cadence = intervalLabel(sub.interval, sub.intervalCount);
  const trial = sub.trialDays > 0 ? `<tr><td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">Free trial</td><td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">${sub.trialDays} days</td></tr>` : "";
  const desc = sub.description ? `<p style="margin:0 0 24px;font-size:14px;color:#6b6560;line-height:1.6;">${escHtml(sub.description)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Set up your ${plan}</title></head>
<body style="margin:0;padding:0;background-color:#fffcf0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fffcf0;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #f0dda0;">
        <tr>
          <td style="background-color:#ffbd5a;padding:24px 32px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td><img src="http://cdn.mcauto-images-production.sendgrid.net/f8d2c7355b303d55/82641b9b-83c5-474f-8b4e-886864a4caff/1000x509.png" alt="BaDjR" width="200" height="100" style="display:block;border:0;border-radius:8px;" /></td>
                <td align="right"><span style="font-size:11px;font-weight:600;color:#0b2d65;background-color:rgba(11,45,101,0.12);padding:4px 12px;border-radius:20px;letter-spacing:0.08em;text-transform:uppercase;">Recurring Plan</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="margin:0 0 8px;font-size:15px;color:#363636;line-height:1.6;">Hi <strong>${client}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#363636;line-height:1.6;"><strong>${sender}</strong> has set up a recurring plan for you. Add a payment method once and it renews automatically — you can update or cancel anytime.</p>
            ${desc}
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e9e9e9;margin-bottom:16px;"><tr><td></td></tr></table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr><td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">Plan</td><td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">${plan}</td></tr>
              <tr><td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">From</td><td align="right" style="font-size:13px;color:#363636;font-weight:500;padding:8px 0;border-bottom:1px solid #f2f2f2;">${sender}</td></tr>
              <tr><td style="font-size:13px;color:#888888;padding:8px 0;border-bottom:1px solid #f2f2f2;">Amount</td><td align="right" style="font-size:13px;color:#363636;font-weight:600;padding:8px 0;border-bottom:1px solid #f2f2f2;">${fmt(sub.amount)} &middot; ${cadence}</td></tr>
              ${trial}
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;">
              <tr><td align="center"><a href="${escHtml(payUrl)}" style="display:inline-block;background-color:#2D5A3D;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;">Set up payment</a></td></tr>
              <tr><td align="center" style="font-size:12px;color:#888888;padding-top:12px;">Secure checkout powered by Stripe. Or paste this link into your browser:<br /><a href="${escHtml(payUrl)}" style="color:#2D5A3D;word-break:break-all;">${escHtml(payUrl)}</a></td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#fffcf0;border-top:1px solid #e9e9e9;padding:16px 32px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="font-size:13px;color:#476c2e;font-weight:600;">BaDjR Invoicing Platform</td>
                <td align="right" style="font-size:11px;color:#888888;">badjrtech.com</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
