import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes, randomInt } from "crypto";

const sql = neon(process.env.DATABASE_URL);
const hash = (s) => createHash("sha256").update(String(s)).digest("hex");
const genId = () => randomBytes(8).toString("hex");

export const CODE_TTL_MIN = { login: 10, bypass: 2, reset: 60 };
const MAX_ATTEMPTS = 5;

export async function initAuthDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS auth_codes (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      attempts INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS trusted_devices (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT DEFAULT '',
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// Issue a one-time secret for a user. Login codes are 6 digits; reset/bypass tokens are long random strings.
export async function issueCode(userId, purpose) {
  const plain = purpose === "login" ? String(randomInt(0, 1000000)).padStart(6, "0") : randomBytes(24).toString("hex");
  await sql`UPDATE auth_codes SET used_at = NOW() WHERE user_id = ${userId} AND purpose = ${purpose} AND used_at IS NULL`;
  await sql`
    INSERT INTO auth_codes (id, user_id, purpose, code_hash, expires_at)
    VALUES (${genId()}, ${userId}, ${purpose}, ${hash(plain)}, NOW() + (${`${CODE_TTL_MIN[purpose] || 10} minutes`})::interval)
  `;
  return plain;
}

// Verify and consume. Returns true once; wrong guesses count toward a lockout of the current code.
export async function consumeCode(userId, purpose, plain) {
  if (!plain) return false;
  const rows = await sql`
    SELECT id, code_hash, attempts FROM auth_codes
    WHERE user_id = ${userId} AND purpose = ${purpose} AND used_at IS NULL AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.attempts >= MAX_ATTEMPTS) return false;
  if (row.code_hash !== hash(String(plain).trim())) {
    await sql`UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ${row.id}`;
    return false;
  }
  await sql`UPDATE auth_codes SET used_at = NOW() WHERE id = ${row.id}`;
  return true;
}

export async function issueTrustedDevice(userId, label = "") {
  const token = randomBytes(32).toString("hex");
  await sql`INSERT INTO trusted_devices (token_hash, user_id, label, expires_at) VALUES (${hash(token)}, ${userId}, ${label}, NOW() + INTERVAL '30 days')`;
  return token;
}

export async function isTrustedDevice(userId, token) {
  if (!token) return false;
  const rows = await sql`SELECT 1 FROM trusted_devices WHERE token_hash = ${hash(token)} AND user_id = ${userId} AND expires_at > NOW()`;
  return rows.length > 0;
}

export async function revokeTrustedDevices(userId) {
  await sql`DELETE FROM trusted_devices WHERE user_id = ${userId}`;
}

export async function setUserPassword(userId, passwordHash) {
  await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
}

export const TRUST_COOKIE = "bp_device";
