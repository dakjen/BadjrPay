import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { initDb, getUserByEmail } from "@/lib/db";
import { issueCode, consumeCode, setUserPassword, revokeTrustedDevices, withinRateLimit, clientIp } from "@/lib/auth-codes";
import { sendMail, mailProvider } from "@/lib/email";
import { buildResetEmail } from "@/lib/auth-email";
import { getBaseUrl } from "@/lib/stripe";

// POST { email } → emails a one-time reset link (always answers ok, so addresses can't be probed)
export async function POST(req) {
  const { email } = await req.json().catch(() => ({}));
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
  await initDb();
  if (!(await withinRateLimit(`reset:${clientIp(req)}`, 5, 15))) return NextResponse.json({ error: "Too many requests. Try again in 15 minutes." }, { status: 429 });
  const user = await getUserByEmail(String(email).trim().toLowerCase()) || await getUserByEmail(String(email).trim());
  if (user && mailProvider()) {
    const token = await issueCode(user.id, "reset");
    const link = `${getBaseUrl(req)}/reset?token=${token}&email=${encodeURIComponent(user.email)}`;
    try { await sendMail({ to: user.email, toName: user.name, subject: "Reset your Badjr-Pay password", html: buildResetEmail({ link, name: user.name }) }); } catch (e) { console.error("reset mail failed", e.message); }
  }
  return NextResponse.json({ ok: true });
}

// PUT { email, token, password } → sets the new password, invalidates the link and any trusted devices
export async function PUT(req) {
  const { email, token, password } = await req.json().catch(() => ({}));
  if (!email || !token || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (String(password).length < 8) return NextResponse.json({ error: "Use at least 8 characters." }, { status: 400 });
  await initDb();
  const user = await getUserByEmail(String(email).trim());
  if (!user || !(await consumeCode(user.id, "reset", token))) return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });
  await setUserPassword(user.id, await bcrypt.hash(password, 12));
  await revokeTrustedDevices(user.id);
  return NextResponse.json({ ok: true });
}
