import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUsers, createUser, deleteUser, initDb } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initDb();
  const users = await listUsers();
  return NextResponse.json(users);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { email, name, password, role } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  const validRoles = ["owner", "team_member", "accountant"];
  const userRole = validRoles.includes(role) ? role : "team_member";
  try {
    const hash = await bcrypt.hash(password, 12);
    const user = await createUser(email, name || email, hash, userRole);
    return NextResponse.json(user);
  } catch (e) {
    return NextResponse.json({ error: "Email already exists" }, { status: 400 });
  }
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
