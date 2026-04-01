import { initDb, listUsers, createUser } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

// Returns whether setup is needed (no users yet)
export async function GET() {
  try {
    await initDb();
    const existing = await listUsers();
    return NextResponse.json({ needsSetup: existing.length === 0 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// One-time setup: creates the first admin user only if no users exist yet.
export async function POST(req) {
  try {
    await initDb();
    const existing = await listUsers();
    if (existing.length > 0) {
      return NextResponse.json({ error: "Setup already complete. Use the admin panel to add more users." }, { status: 403 });
    }
    const { email, name, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    const hash = await bcrypt.hash(password, 12);
    const user = await createUser(email, name || email, hash);
    return NextResponse.json({ ok: true, user: { email: user.email, name: user.name } });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
