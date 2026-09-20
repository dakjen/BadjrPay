import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const genId = () => Math.random().toString(36).substr(2, 9);

export const PRODUCT_CATEGORIES = [["saas", "SaaS"], ["custom", "Custom build"], ["consulting", "Consulting"], ["maintenance", "Maintenance"], ["other", "Other"]];

export async function initProductsDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS product_lines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS product_rules (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      product_line_id TEXT NOT NULL REFERENCES product_lines(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS product_line_id TEXT`;
  await sql`ALTER TABLE bk_transactions ADD COLUMN IF NOT EXISTS product_line_id TEXT`;
  // Starter lines + one rule, so Merge sales classify from day one
  const seed = [
    { id: "pl_merge", name: "Merge", category: "saas", sort: 0 },
    { id: "pl_custom", name: "Custom Build", category: "custom", sort: 10 },
    { id: "pl_consulting", name: "Consulting", category: "consulting", sort: 20 },
    { id: "pl_maintenance", name: "Maintenance", category: "maintenance", sort: 30 },
  ];
  for (const l of seed) await sql`INSERT INTO product_lines (id, name, category, sort_order) VALUES (${l.id}, ${l.name}, ${l.category}, ${l.sort}) ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO product_rules (id, pattern, product_line_id) VALUES ('pr_merge', 'merge', 'pl_merge') ON CONFLICT (id) DO NOTHING`;
}

export async function listProductLines() {
  return (await sql`SELECT * FROM product_lines ORDER BY sort_order, name`).map(r => ({ id: r.id, name: r.name, category: r.category, sortOrder: r.sort_order }));
}
export async function upsertProductLine(l) {
  const id = l.id || ("pl_" + genId());
  await sql`INSERT INTO product_lines (id, name, category, sort_order) VALUES (${id}, ${l.name}, ${l.category || "other"}, ${l.sortOrder ?? 50}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, sort_order = EXCLUDED.sort_order`;
  return id;
}
export async function deleteProductLine(id) {
  await sql`UPDATE invoices SET product_line_id = NULL WHERE product_line_id = ${id}`;
  await sql`UPDATE bk_transactions SET product_line_id = NULL WHERE product_line_id = ${id}`;
  await sql`DELETE FROM product_lines WHERE id = ${id}`;
}

export async function listProductRules() {
  return (await sql`SELECT * FROM product_rules ORDER BY created_at DESC`).map(r => ({ id: r.id, pattern: r.pattern, productLineId: r.product_line_id }));
}
export async function addProductRule(pattern, productLineId) {
  const p = String(pattern || "").trim().toLowerCase();
  if (!p) throw new Error("Pattern required");
  await sql`INSERT INTO product_rules (id, pattern, product_line_id) VALUES (${"pr_" + genId()}, ${p}, ${productLineId})`;
}
export async function deleteProductRule(id) { await sql`DELETE FROM product_rules WHERE id = ${id}`; }

export async function setInvoiceProductLine(invoiceId, productLineId) { await sql`UPDATE invoices SET product_line_id = ${productLineId || null} WHERE id = ${invoiceId}`; }
export async function setTransactionProductLine(txId, productLineId) { await sql`UPDATE bk_transactions SET product_line_id = ${productLineId || null} WHERE id = ${txId}`; }

// Revenue sources for the last N months (dates as YYYY-MM-DD)
export async function listRevenueSources(sinceISO) {
  const [invoices, ledger] = await Promise.all([
    sql`
      SELECT i.id, i.number, i.client_name, i.total, i.product_line_id, COALESCE(i.paid_at, i.created_at::date) AS paid_on,
             COALESCE((SELECT string_agg(description, ' | ') FROM invoice_items it WHERE it.invoice_id = i.id), '') AS items,
             COALESCE((SELECT string_agg(name, ' | ') FROM projects p WHERE p.id = i.project_id), '') AS project
      FROM invoices i WHERE i.status = 'paid' AND COALESCE(i.paid_at, i.created_at::date) >= ${sinceISO}
    `,
    sql`
      SELECT id, date, amount, name, description, vendor, reference, product_line_id, source
      FROM bk_transactions
      WHERE type = 'income' AND invoice_id IS NULL AND source <> 'stripe' AND date >= ${sinceISO}
        AND NOT (COALESCE(description, '') ILIKE '%stripe%' OR COALESCE(name, '') ILIKE '%stripe%')
    `,
  ]);
  return { invoices, ledger };
}
