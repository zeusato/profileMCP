import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
if (!process.argv.includes('--execute')) throw new Error('Review docs/database/20261009_002_runtime.sql, then use --execute with MIGRATION_DATABASE_URL. Never rerun baseline 001.');
if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL required');
const sql = postgres(process.env.MIGRATION_DATABASE_URL, { ssl: 'require', max: 1, prepare: false });
try {
  const versions = await sql`select version from profile_mcp.schema_versions`;
  if (!versions.some(v => v.version === '20261009_001')) throw new Error('Baseline missing');
  if (versions.some(v => v.version === '20261009_002')) console.log('Runtime migration already applied');
  else { await sql.unsafe(await readFile('docs/database/20261009_002_runtime.sql', 'utf8')); console.log('Runtime migration applied'); }
} finally { await sql.end(); }
