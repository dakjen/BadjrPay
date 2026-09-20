import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { productReport } from "@/lib/products";
import { upsertProductLine, deleteProductLine, addProductRule, deleteProductRule, setInvoiceProductLine, setTransactionProductLine } from "@/lib/products-db";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await initDb();
    const months = Math.min(24, Math.max(3, parseInt(new URL(req.url).searchParams.get("months")) || 12));
    return NextResponse.json(await productReport(months), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user.role || "owner") === "accountant") return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  try {
    await initDb();
    const { action, data = {} } = await req.json();
    switch (action) {
      case "upsert_line": { const id = await upsertProductLine(data); return NextResponse.json({ ok: true, id }); }
      case "delete_line": await deleteProductLine(data.id); break;
      case "add_rule": await addProductRule(data.pattern, data.productLineId); break;
      case "delete_rule": await deleteProductRule(data.id); break;
      // "Label once": pin this item, and (optionally) remember the pattern for everything like it
      case "label": {
        if (data.source === "invoice") await setInvoiceProductLine(data.id, data.productLineId);
        if (data.source === "ledger") await setTransactionProductLine(data.id, data.productLineId);
        if (data.pattern) await addProductRule(data.pattern, data.productLineId);
        break;
      }
      default: return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
