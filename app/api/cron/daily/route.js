import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getBaseUrl } from "@/lib/stripe";
import { runDaily } from "@/lib/notify";

export const maxDuration = 60;

// Vercel Cron hits this every morning (see vercel.json). Guarded by CRON_SECRET.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await initDb();
    const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
    const result = await runDaily(process.env.APP_URL || getBaseUrl(req), { dryRun });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("cron/daily failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
