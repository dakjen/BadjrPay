import { escHtml } from "./email";

function shell({ title, badge, body }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#F7F5F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F7F5F0;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="480" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2DDD3;">
  <tr><td style="background-color:#2D5A3D;padding:20px 28px;color:#fff;"><span style="font-size:18px;font-weight:700;">Badjr-Pay</span><span style="float:right;font-size:11px;font-weight:600;background:rgba(255,255,255,0.18);padding:4px 10px;border-radius:20px;letter-spacing:0.08em;text-transform:uppercase;">${escHtml(badge)}</span></td></tr>
  <tr><td style="padding:28px;">${body}</td></tr>
  <tr><td style="background-color:#F7F5F0;border-top:1px solid #EDE9E1;padding:14px 28px;font-size:12px;color:#9C9590;">If you didn't request this, you can ignore this email — nothing changes without the code or link.</td></tr>
</table></td></tr></table></body></html>`;
}

export function buildLoginCodeEmail({ code, name }) {
  return shell({ title: "Your sign-in code", badge: "Sign in", body: `
    <p style="margin:0 0 8px;font-size:15px;color:#1A1A1A;">Hi ${escHtml(name || "there")},</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6B6560;line-height:1.6;">Here's your one-time code to finish signing in to Badjr-Pay. It expires in 10 minutes.</p>
    <div style="text-align:center;margin:8px 0 20px;"><span style="display:inline-block;font-size:34px;font-weight:700;letter-spacing:0.28em;color:#2D5A3D;background:#E8F0EB;padding:14px 22px 14px 30px;border-radius:10px;font-family:'Courier New',monospace;">${escHtml(code)}</span></div>
    <p style="margin:0;font-size:12px;color:#9C9590;">Never share this code. Badjr-Pay will never ask for it by phone or text.</p>` });
}

export function buildResetEmail({ link, name }) {
  return shell({ title: "Reset your password", badge: "Password reset", body: `
    <p style="margin:0 0 8px;font-size:15px;color:#1A1A1A;">Hi ${escHtml(name || "there")},</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6B6560;line-height:1.6;">Someone asked to reset the password for this Badjr-Pay account. The link below works once and expires in 1 hour.</p>
    <div style="text-align:center;margin:8px 0 20px;"><a href="${escHtml(link)}" style="display:inline-block;background-color:#2D5A3D;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">Choose a new password</a></div>
    <p style="margin:0;font-size:12px;color:#9C9590;word-break:break-all;">Or paste this into your browser:<br/><a href="${escHtml(link)}" style="color:#2D5A3D;">${escHtml(link)}</a></p>` });
}
