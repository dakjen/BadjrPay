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
    CREATE TABLE IF NOT EXISTS app_data (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    INSERT INTO app_data (id, data) VALUES (1, '{}') ON CONFLICT DO NOTHING
  `;
}

export async function getAppData() {
  const rows = await sql`SELECT data FROM app_data WHERE id = 1`;
  return rows[0]?.data || {};
}

export async function setAppData(data) {
  await sql`
    INSERT INTO app_data (id, data, updated_at) VALUES (1, ${JSON.stringify(data)}, NOW())
    ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(data)}, updated_at = NOW()
  `;
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
