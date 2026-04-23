import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Normalize any date value to YYYY-MM-DD for PostgreSQL, or null if unparseable
function toISODate(d) {
  if (!d) return null;
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return null;
}

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT DEFAULT '',
      company_address TEXT DEFAULT '',
      company_phone TEXT DEFAULT ''
    )
  `;
  await sql`INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING`;
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6B6560'
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      rate NUMERIC(10,2) DEFAULT 0,
      unit TEXT DEFAULT 'per hour',
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      number TEXT DEFAULT '',
      client_id TEXT,
      client_name TEXT DEFAULT '',
      client_email TEXT DEFAULT '',
      client_phone TEXT DEFAULT '',
      client_address TEXT DEFAULT '',
      project_id TEXT DEFAULT '',
      due_date DATE,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      amount_paid NUMERIC(10,2) DEFAULT 0,
      total NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id TEXT`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deposit NUMERIC(10,2) DEFAULT 0`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at DATE`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at DATE`;
  await sql`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT DEFAULT '',
      qty NUMERIC(10,2) DEFAULT 1,
      rate NUMERIC(10,2) DEFAULT 0,
      amount NUMERIC(10,2) DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS invoice_installments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount NUMERIC(10,2) NOT NULL,
      due_date DATE NOT NULL,
      status TEXT DEFAULT 'pending',
      paid_at DATE,
      sort_order INTEGER DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      client_name TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at DATE
    )
  `;

  // ── Bookkeeping tables ──
  await sql`
    CREATE TABLE IF NOT EXISTS bk_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      account_type TEXT DEFAULT 'checking',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bk_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      parent TEXT DEFAULT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `;
  // Seed default bookkeeping categories
  const seedCats = [
    { id: 'bkc_revenue', name: 'Revenue', type: 'income', parent: null, sort: 0 },
    { id: 'bkc_other_income', name: 'Other Income', type: 'income', parent: null, sort: 1 },
    { id: 'bkc_cogs', name: 'Cost of Goods Sold', type: 'expense', parent: null, sort: 10 },
    { id: 'bkc_sub_labor', name: 'Subcontractor Labor', type: 'expense', parent: 'bkc_cogs', sort: 11 },
    { id: 'bkc_rent', name: 'Rent', type: 'expense', parent: null, sort: 20 },
    { id: 'bkc_utilities', name: 'Utilities', type: 'expense', parent: null, sort: 21 },
    { id: 'bkc_insurance', name: 'Insurance', type: 'expense', parent: null, sort: 22 },
    { id: 'bkc_office', name: 'Office Supplies', type: 'expense', parent: null, sort: 23 },
    { id: 'bkc_software', name: 'Software & Subscriptions', type: 'expense', parent: null, sort: 24 },
    { id: 'bkc_marketing', name: 'Marketing', type: 'expense', parent: null, sort: 25 },
    { id: 'bkc_professional', name: 'Professional Services', type: 'expense', parent: null, sort: 26 },
    { id: 'bkc_travel', name: 'Travel', type: 'expense', parent: null, sort: 27 },
    { id: 'bkc_meals', name: 'Meals', type: 'expense', parent: null, sort: 28 },
    { id: 'bkc_misc', name: 'Miscellaneous', type: 'expense', parent: null, sort: 29 },
    { id: 'bkc_wages', name: 'Wages', type: 'expense', parent: null, sort: 30 },
    { id: 'bkc_payroll_tax', name: 'Payroll Taxes', type: 'expense', parent: null, sort: 31 },
    { id: 'bkc_benefits', name: 'Benefits', type: 'expense', parent: null, sort: 32 },
    { id: 'bkc_contractor', name: '1099 Contractor Payments', type: 'expense', parent: null, sort: 40 },
  ];
  for (const c of seedCats) {
    await sql`INSERT INTO bk_categories (id, name, type, parent, sort_order) VALUES (${c.id}, ${c.name}, ${c.type}, ${c.parent}, ${c.sort}) ON CONFLICT (id) DO NOTHING`;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS bk_transactions (
      id TEXT PRIMARY KEY,
      date DATE NOT NULL,
      description TEXT DEFAULT '',
      name TEXT DEFAULT '',
      amount NUMERIC(12,2) NOT NULL,
      category_id TEXT REFERENCES bk_categories(id) ON DELETE SET NULL,
      account_id TEXT REFERENCES bk_accounts(id) ON DELETE SET NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      vendor TEXT DEFAULT '',
      reference TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      reconciled BOOLEAN DEFAULT FALSE,
      reviewed BOOLEAN DEFAULT FALSE,
      source TEXT DEFAULT 'manual',
      import_batch_id TEXT DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bk_payroll_records (
      id TEXT PRIMARY KEY,
      employee_name TEXT NOT NULL,
      pay_date DATE NOT NULL,
      pay_period_start DATE,
      pay_period_end DATE,
      gross_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
      net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
      federal_withholding NUMERIC(12,2) DEFAULT 0,
      state_withholding NUMERIC(12,2) DEFAULT 0,
      fica_ss NUMERIC(12,2) DEFAULT 0,
      fica_medicare NUMERIC(12,2) DEFAULT 0,
      fica_employer_ss NUMERIC(12,2) DEFAULT 0,
      fica_employer_medicare NUMERIC(12,2) DEFAULT 0,
      other_deductions NUMERIC(12,2) DEFAULT 0,
      notes TEXT DEFAULT '',
      transaction_id TEXT REFERENCES bk_transactions(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bk_contractors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      business_name TEXT DEFAULT '',
      ein_last4 TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bk_contractor_payments (
      id TEXT PRIMARY KEY,
      contractor_id TEXT NOT NULL REFERENCES bk_contractors(id) ON DELETE CASCADE,
      transaction_id TEXT REFERENCES bk_transactions(id) ON DELETE SET NULL,
      amount NUMERIC(12,2) NOT NULL,
      pay_date DATE NOT NULL,
      description TEXT DEFAULT '',
      year INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Migrate legacy admin role to owner
  await sql`UPDATE users SET role = 'owner' WHERE role = 'admin'`;
}

export async function getAppData() {
  await initDb();

  // One-time migration from legacy app_data JSONB table
  try {
    const [invCount] = await sql`SELECT COUNT(*) as count FROM invoices`;
    const [catCount] = await sql`SELECT COUNT(*) as count FROM categories`;
    const [svcCount] = await sql`SELECT COUNT(*) as count FROM services`;
    const isEmpty = parseInt(invCount.count) + parseInt(catCount.count) + parseInt(svcCount.count) === 0;
    if (isEmpty) {
      const oldRows = await sql`SELECT data FROM app_data WHERE id = 1`.catch(() => []);
      const legacy = oldRows[0]?.data;
      if (legacy && Object.keys(legacy).length > 0) {
        await setAppData(legacy);
      }
    }
  } catch (_) {}

  const [settingsRows, clients, categories, services, invoiceRows, itemRows, installmentRows, projects] = await Promise.all([
    sql`SELECT * FROM settings WHERE id = 1`,
    sql`SELECT * FROM clients ORDER BY name`,
    sql`SELECT * FROM categories ORDER BY name`,
    sql`SELECT * FROM services ORDER BY name`,
    sql`SELECT * FROM invoices ORDER BY created_at DESC`,
    sql`SELECT * FROM invoice_items ORDER BY invoice_id, sort_order`,
    sql`SELECT * FROM invoice_installments ORDER BY invoice_id, sort_order`,
    sql`SELECT * FROM projects ORDER BY created_at DESC`,
  ]);

  const s = settingsRows[0] || {};

  const itemsByInvoice = {};
  for (const item of itemRows) {
    if (!itemsByInvoice[item.invoice_id]) itemsByInvoice[item.invoice_id] = [];
    itemsByInvoice[item.invoice_id].push({
      description: item.description,
      qty: parseFloat(item.qty),
      rate: parseFloat(item.rate),
      amount: parseFloat(item.amount),
    });
  }

  const installmentsByInvoice = {};
  for (const inst of installmentRows) {
    if (!installmentsByInvoice[inst.invoice_id]) installmentsByInvoice[inst.invoice_id] = [];
    installmentsByInvoice[inst.invoice_id].push({
      id: inst.id,
      amount: parseFloat(inst.amount),
      dueDate: toISODate(inst.due_date) || '',
      status: inst.status,
      paidAt: toISODate(inst.paid_at) || null,
      sortOrder: inst.sort_order,
    });
  }

  return {
    clients: clients.map(c => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, address: c.address })),
    categories: categories.map(c => ({ id: c.id, name: c.name, color: c.color })),
    services: services.map(sv => ({
      id: sv.id,
      name: sv.name,
      description: sv.description,
      rate: parseFloat(sv.rate),
      unit: sv.unit,
      categoryId: sv.category_id,
    })),
    invoices: invoiceRows.map(inv => ({
      id: inv.id,
      number: inv.number,
      clientId: inv.client_id || '',
      clientName: inv.client_name,
      clientEmail: inv.client_email,
      clientPhone: inv.client_phone,
      clientAddress: inv.client_address,
      projectId: inv.project_id,
      dueDate: toISODate(inv.due_date) || '',
      createdAt: toISODate(inv.created_at) || '',
      sentAt: toISODate(inv.sent_at) || '',
      paidAt: toISODate(inv.paid_at) || '',
      notes: inv.notes,
      status: inv.status,
      amountPaid: parseFloat(inv.amount_paid),
      total: parseFloat(inv.total),
      deposit: parseFloat(inv.deposit || 0),
      items: itemsByInvoice[inv.id] || [],
      installments: installmentsByInvoice[inv.id] || [],
    })),
    projects: projects.map(p => ({ id: p.id, name: p.name, description: p.description, clientName: p.client_name, status: p.status, createdAt: toISODate(p.created_at) || null })),
    settings: {
      companyName: s.company_name || '',
      companyAddress: s.company_address || '',
      companyPhone: s.company_phone || '',
    },
  };
}

export async function setAppData(data) {
  // Settings
  const s = data.settings || {};
  await sql`
    INSERT INTO settings (id, company_name, company_address, company_phone)
    VALUES (1, ${s.companyName || ''}, ${s.companyAddress || ''}, ${s.companyPhone || ''})
    ON CONFLICT (id) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      company_address = EXCLUDED.company_address,
      company_phone = EXCLUDED.company_phone
  `;

  // Clients
  const cls = data.clients || [];
  for (const cl of cls) {
    await sql`
      INSERT INTO clients (id, name, email, phone, address)
      VALUES (${cl.id}, ${cl.name}, ${cl.email || ''}, ${cl.phone || ''}, ${cl.address || ''})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, address = EXCLUDED.address
    `;
  }
  if (cls.length > 0) {
    const clIds = cls.map(c => c.id);
    await sql`DELETE FROM clients WHERE id != ALL(${clIds}::text[])`;
  } else {
    await sql`DELETE FROM clients`;
  }

  // Categories
  const cats = data.categories || [];
  for (const cat of cats) {
    await sql`
      INSERT INTO categories (id, name, color)
      VALUES (${cat.id}, ${cat.name}, ${cat.color || '#6B6560'})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color
    `;
  }
  if (cats.length > 0) {
    const catIds = cats.map(c => c.id);
    await sql`DELETE FROM categories WHERE id != ALL(${catIds}::text[])`;
  } else {
    await sql`DELETE FROM categories`;
  }

  // Services
  const svcs = data.services || [];
  for (const svc of svcs) {
    await sql`
      INSERT INTO services (id, name, description, rate, unit, category_id)
      VALUES (${svc.id}, ${svc.name}, ${svc.description || ''}, ${svc.rate || 0}, ${svc.unit || 'per hour'}, ${svc.categoryId || null})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        rate = EXCLUDED.rate,
        unit = EXCLUDED.unit,
        category_id = EXCLUDED.category_id
    `;
  }
  if (svcs.length > 0) {
    const svcIds = svcs.map(sv => sv.id);
    await sql`DELETE FROM services WHERE id != ALL(${svcIds}::text[])`;
  } else {
    await sql`DELETE FROM services`;
  }

  // Projects
  const projs = data.projects || [];
  for (const proj of projs) {
    await sql`
      INSERT INTO projects (id, name, description, client_name, status, created_at)
      VALUES (${proj.id}, ${proj.name}, ${proj.description || ''}, ${proj.clientName || ''}, ${proj.status || 'active'}, ${toISODate(proj.createdAt)})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        client_name = EXCLUDED.client_name,
        status = EXCLUDED.status,
        created_at = EXCLUDED.created_at
    `;
  }
  if (projs.length > 0) {
    const projIds = projs.map(p => p.id);
    await sql`DELETE FROM projects WHERE id != ALL(${projIds}::text[])`;
  } else {
    await sql`DELETE FROM projects`;
  }

  const clIdSet = new Set((data.clients || []).map(c => c.id));

  // Invoices and their items
  const invs = data.invoices || [];
  for (const inv of invs) {
    const resolvedClientId = inv.clientId && clIdSet.has(inv.clientId) ? inv.clientId : null;
    await sql`
      INSERT INTO invoices (id, number, client_id, client_name, client_email, client_phone, client_address, project_id, due_date, notes, status, amount_paid, total, deposit, sent_at, paid_at)
      VALUES (
        ${inv.id}, ${inv.number || ''}, ${resolvedClientId}, ${inv.clientName || ''}, ${inv.clientEmail || ''},
        ${inv.clientPhone || ''}, ${inv.clientAddress || ''}, ${inv.projectId || ''},
        ${toISODate(inv.dueDate)}, ${inv.notes || ''}, ${inv.status || 'draft'},
        ${inv.amountPaid || 0}, ${inv.total || 0}, ${inv.deposit || 0},
        ${toISODate(inv.sentAt) || null}, ${toISODate(inv.paidAt) || null}
      )
      ON CONFLICT (id) DO UPDATE SET
        number = EXCLUDED.number,
        client_id = ${resolvedClientId},
        client_name = EXCLUDED.client_name,
        client_email = EXCLUDED.client_email,
        client_phone = EXCLUDED.client_phone,
        client_address = EXCLUDED.client_address,
        project_id = EXCLUDED.project_id,
        due_date = EXCLUDED.due_date,
        notes = EXCLUDED.notes,
        status = EXCLUDED.status,
        amount_paid = EXCLUDED.amount_paid,
        total = EXCLUDED.total,
        deposit = EXCLUDED.deposit,
        sent_at = EXCLUDED.sent_at,
        paid_at = EXCLUDED.paid_at
    `;
    await sql`DELETE FROM invoice_items WHERE invoice_id = ${inv.id}`;
    const items = inv.items || [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await sql`
        INSERT INTO invoice_items (invoice_id, description, qty, rate, amount, sort_order)
        VALUES (${inv.id}, ${item.description || ''}, ${item.qty || 1}, ${item.rate || 0}, ${item.amount || 0}, ${i})
      `;
    }
    // Installments — upsert, keep paid ones intact
    const installments = inv.installments || [];
    const instIds = installments.map(inst => inst.id);
    if (instIds.length > 0) {
      await sql`DELETE FROM invoice_installments WHERE invoice_id = ${inv.id} AND id != ALL(${instIds}::text[])`;
    } else {
      await sql`DELETE FROM invoice_installments WHERE invoice_id = ${inv.id}`;
    }
    for (let i = 0; i < installments.length; i++) {
      const inst = installments[i];
      await sql`
        INSERT INTO invoice_installments (id, invoice_id, amount, due_date, status, paid_at, sort_order)
        VALUES (${inst.id}, ${inv.id}, ${inst.amount}, ${toISODate(inst.dueDate)}, ${inst.status || 'pending'}, ${toISODate(inst.paidAt)}, ${i})
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          due_date = ${toISODate(inst.dueDate)},
          status = EXCLUDED.status,
          paid_at = ${toISODate(inst.paidAt)},
          sort_order = EXCLUDED.sort_order
      `;
    }
  }
  if (invs.length > 0) {
    const invIds = invs.map(i => i.id);
    await sql`DELETE FROM invoices WHERE id != ALL(${invIds}::text[])`;
  } else {
    await sql`DELETE FROM invoices`;
  }
}

export async function getUserByEmail(email) {
  const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] || null;
}

export async function listUsers() {
  return sql`SELECT id, email, name, role, created_at FROM users ORDER BY created_at`;
}

export async function createUser(email, name, passwordHash, role = "team_member") {
  const rows = await sql`
    INSERT INTO users (email, name, password_hash, role) VALUES (${email}, ${name}, ${passwordHash}, ${role})
    RETURNING id, email, name, role
  `;
  return rows[0];
}

export async function deleteUser(id) {
  await sql`DELETE FROM users WHERE id = ${id}`;
}
