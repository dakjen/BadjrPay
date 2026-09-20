import { del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { addAttachment, getAttachment, deleteAttachment, listAttachments } from "@/lib/billing-db";
import { NextResponse } from "next/server";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initDb();
  const invoiceId = new URL(req.url).searchParams.get("invoiceId");
  return NextResponse.json({ configured: !!process.env.BLOB_READ_WRITE_TOKEN, attachments: invoiceId ? await listAttachments(invoiceId) : [] });
}

// Record a file the browser just uploaded to Blob
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { invoiceId, filename, url, size, contentType } = await req.json();
  if (!invoiceId || !filename || !url) return NextResponse.json({ error: "invoiceId, filename and url required" }, { status: 400 });
  await initDb();
  const a = await addAttachment({ invoiceId, filename, url, size, contentType, uploadedBy: session.user.email });
  return NextResponse.json({ ok: true, attachment: a });
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "accountant") return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  const { id } = await req.json();
  await initDb();
  const a = await getAttachment(id);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try { await del(a.url); } catch (e) { console.error("blob delete failed", e.message); }
  await deleteAttachment(id);
  return NextResponse.json({ ok: true });
}
