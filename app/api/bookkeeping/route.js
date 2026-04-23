import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb } from "@/lib/db";
import {
  getBookkeepingData, getPnLData,
  upsertTransaction, bulkImportTransactions, deleteTransaction, deleteBatch,
  reconcileTransactions, reviewTransactions,
  upsertPayroll, deletePayroll,
  upsertContractor, deleteContractor,
  upsertContractorPayment, deleteContractorPayment,
  upsertAccount, deleteAccount,
  upsertBkCategory, deleteBkCategory,
} from "@/lib/bookkeeping-db";
import { NextResponse } from "next/server";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")) : null;
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")) : null;

    // Check for P&L request
    if (searchParams.get("report") === "pnl") {
      const start = searchParams.get("start") || `${year || new Date().getFullYear()}-01-01`;
      const end = searchParams.get("end") || `${year || new Date().getFullYear()}-12-31`;
      const pnl = await getPnLData(start, end);
      return NextResponse.json({ pnl }, { headers: { "Cache-Control": "no-store" } });
    }

    const data = await getBookkeepingData(year, month);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role || "owner";

  // Accountant = read-only
  if (role === "accountant") {
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  }

  try {
    await initDb();
    const { action, data } = await req.json();

    // Team member limited actions
    const teamAllowed = ["upsert_transaction", "bulk_import_transactions", "upsert_payroll", "reconcile_transactions", "review_transactions"];
    if (role === "team_member" && !teamAllowed.includes(action)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    switch (action) {
      case "upsert_transaction":
        await upsertTransaction(data);
        break;
      case "bulk_import_transactions":
        await bulkImportTransactions(data.transactions);
        return NextResponse.json({ ok: true, count: data.transactions.length });
      case "delete_transaction":
        await deleteTransaction(data.id);
        break;
      case "delete_batch":
        await deleteBatch(data.batchId);
        break;
      case "reconcile_transactions":
        await reconcileTransactions(data.ids, data.reconciled !== false);
        break;
      case "review_transactions":
        await reviewTransactions(data.ids, data.reviewed !== false);
        break;
      case "upsert_payroll":
        await upsertPayroll(data);
        break;
      case "delete_payroll":
        await deletePayroll(data.id);
        break;
      case "upsert_contractor":
        await upsertContractor(data);
        break;
      case "delete_contractor":
        await deleteContractor(data.id);
        break;
      case "upsert_contractor_payment":
        await upsertContractorPayment(data);
        break;
      case "delete_contractor_payment":
        await deleteContractorPayment(data.id);
        break;
      case "upsert_account":
        await upsertAccount(data);
        break;
      case "delete_account":
        await deleteAccount(data.id);
        break;
      case "upsert_category":
        await upsertBkCategory(data);
        break;
      case "delete_category":
        await deleteBkCategory(data.id);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
