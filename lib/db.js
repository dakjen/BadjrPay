import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

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
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
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
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL`;
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

  const [settingsRows, clients, categories, services, invoiceRows, itemRows] = await Promise.all([
    sql`SELECT * FROM settings WHERE id = 1`,
    sql`SELECT * FROM clients ORDER BY name`,
    sql`SELECT * FROM categories ORDER BY name`,
    sql`SELECT * FROM services ORDER BY name`,
    sql`SELECT * FROM invoices ORDER BY created_at DESC`,
    sql`SELECT * FROM invoice_items ORDER BY invoice_id, sort_order`,
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
      dueDate: inv.due_date ? String(inv.due_date).slice(0, 10) : '',
      notes: inv.notes,
      status: inv.status,
      amountPaid: parseFloat(inv.amount_paid),
      total: parseFloat(inv.total),
      items: itemsByInvoice[inv.id] || [],
    })),
    projects: [],
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

  // Invoices and their items
  const invs = data.invoices || [];
  for (const inv of invs) {
    await sql`
      INSERT INTO invoices (id, number, client_id, client_name, client_email, client_phone, client_address, project_id, due_date, notes, status, amount_paid, total)
      VALUES (
        ${inv.id}, ${inv.number || ''}, ${inv.clientId || null}, ${inv.clientName || ''}, ${inv.clientEmail || ''},
        ${inv.clientPhone || ''}, ${inv.clientAddress || ''}, ${inv.projectId || ''},
        ${inv.dueDate || null}, ${inv.notes || ''}, ${inv.status || 'draft'},
        ${inv.amountPaid || 0}, ${inv.total || 0}
      )
      ON CONFLICT (id) DO UPDATE SET
        number = EXCLUDED.number,
        client_id = EXCLUDED.client_id,
        client_name = EXCLUDED.client_name,
        client_email = EXCLUDED.client_email,
        client_phone = EXCLUDED.client_phone,
        client_address = EXCLUDED.client_address,
        project_id = EXCLUDED.project_id,
        due_date = EXCLUDED.due_date,
        notes = EXCLUDED.notes,
        status = EXCLUDED.status,
        amount_paid = EXCLUDED.amount_paid,
        total = EXCLUDED.total
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

export async function createUser(email, name, passwordHash) {
  const rows = await sql`
    INSERT INTO users (email, name, password_hash) VALUES (${email}, ${name}, ${passwordHash})
    RETURNING id, email, name, role
  `;
  return rows[0];
}

export async function deleteUser(id) {
  await sql`DELETE FROM users WHERE id = ${id}`;
}
