import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { initDb, getUserByEmail } from "@/lib/db";
import { issueCode, consumeCode, issueTrustedDevice, isTrustedDevice, TRUST_COOKIE, withinRateLimit, clientIp } from "@/lib/auth-codes";
import { sendMail, mailProvider } from "@/lib/email";
import { buildLoginCodeEmail } from "@/lib/auth-email";

const maskEmail = (e) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "•".repeat(Math.min(6, b.length)) + c);
const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 24 * 3600 };

// Step 1 (POST): password check → either a trusted-device bypass or an emailed 6-digit code.
// Step 2 (PUT):  code check → bypass token the login form hands to NextAuth (and optionally a trusted-device cookie).
export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  await initDb();
  const okEmail = await withinRateLimit(`pw:${String(email).trim().toLowerCase()}`, 10, 15);
  const okIp = await withinRateLimit(`ip:${clientIp(req)}`, 40, 15);
  if (!okEmail || !okIp) return NextResponse.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
  const user = await getUserByEmail(String(email).trim().toLowerCase()) || await getUserByEmail(String(email).trim());
  const valid = user && await bcrypt.compare(password, user.password_hash);
  if (!valid) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

  if (await isTrustedDevice(user.id, req.cookies.get(TRUST_COOKIE)?.value)) {
    return NextResponse.json({ ok: true, bypass: await issueCode(user.id, "bypass") });
  }
  if (!mailProvider()) return NextResponse.json({ error: "Email isn't configured, so sign-in codes can't be sent. Ask an owner to set BREVO_API_KEY." }, { status: 500 });
  const code = await issueCode(user.id, "login");
  try {
    await sendMail({ to: user.email, toName: user.name, subject: `${code} is your Badjr-Pay sign-in code`, html: buildLoginCodeEmail({ code, name: user.name }) });
  } catch (e) {
    return NextResponse.json({ error: `Couldn't send the code: ${e.message}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, codeSent: true, to: maskEmail(user.email) });
}

export async function PUT(req) {
  const { email, password, code, remember } = await req.json().catch(() => ({}));
  if (!email || !password || !code) return NextResponse.json({ error: "Code required" }, { status: 400 });
  await initDb();
  if (!(await withinRateLimit(`code:${String(email).trim().toLowerCase()}`, 10, 15))) return NextResponse.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
  const user = await getUserByEmail(String(email).trim().toLowerCase()) || await getUserByEmail(String(email).trim());
  const valid = user && await bcrypt.compare(password, user.password_hash);
  if (!valid) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  if (!(await consumeCode(user.id, "login", code))) return NextResponse.json({ error: "That code isn't right or has expired. Request a new one." }, { status: 401 });

  const res = NextResponse.json({ ok: true, bypass: await issueCode(user.id, "bypass") });
  if (remember) res.cookies.set(TRUST_COOKIE, await issueTrustedDevice(user.id, req.headers.get("user-agent")?.slice(0, 120) || ""), cookieOpts);
  return res;
}
