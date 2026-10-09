import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
const env = JSON.parse(await readFile('.runtime/env.production.json', 'utf8'));
const sql = postgres(env.DATABASE_URL, { ssl: { rejectUnauthorized: true, ca: env.DATABASE_CA_CERT }, max: 1, prepare: false, connect_timeout: 8 });
try {
  const rows = await sql`select current_user as role, profile_mcp.runtime_rpc('health','{}'::jsonb) as health`;
  console.log(JSON.stringify(rows));
} catch (error) { console.log(JSON.stringify({ code: error.code ?? 'CONNECTION_FAILED' })); process.exitCode = 1; }
finally { await sql.end({ timeout: 1 }); }
