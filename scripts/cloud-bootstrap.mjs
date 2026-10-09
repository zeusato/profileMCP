// Administrative provisioning. All generated credentials remain in ignored .runtime files.
// Never print environment values, generated SQL or child-process output containing secrets.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { generateKeyPair, exportJWK } from 'jose';
const project = 'rcdmgdnxndyjnosxikbu';
await mkdir('.runtime', { recursive: true });
const envPath = '.runtime/env.production.json';
try { await access(envPath); console.log('Existing secret material preserved.'); process.exit(0); } catch {}
const pooler = new URL((await readFile('supabase/.temp/pooler-url', 'utf8')).trim());
if (!pooler.hostname.endsWith('.pooler.supabase.com')) throw new Error('Unexpected pooler host');
const password = randomBytes(32).toString('base64url');
pooler.username = `profile_mcp_app.${project}`; pooler.password = password; pooler.port = '6543'; pooler.search = '?sslmode=require';
const { privateKey } = await generateKeyPair('RS256', { extractable: true });
const env = {
  APP_ORIGIN: '', OAUTH_ISSUER: '', MCP_RESOURCE_URL: '', APP_ENV: 'production', DATABASE_URL: pooler.toString(),
  AUTH_ALLOWED_TEAM_ID: randomUUID(), SESSION_ENCRYPTION_KEYRING: JSON.stringify({ active: 'v1', keys: { v1: randomBytes(32).toString('base64url') } }),
  TOKEN_HMAC_KEY: randomBytes(32).toString('base64url'), COOKIE_SECRET: randomBytes(48).toString('base64url'),
  OAUTH_SIGNING_KEYS: JSON.stringify({ keys: [{ ...await exportJWK(privateKey), kid: 'profile-20261009', alg: 'RS256', use: 'sig' }] }),
  OAUTH_CLIENTS: '[]', SHA_LIVE_AUTH_ENABLED: 'true', SHA_REFRESH_ENABLED: 'false', SHA_UPSTREAM_BASE_URL: 'https://api.shs.com.vn',
};
await writeFile(envPath, JSON.stringify(env), { flag: 'wx' });
const sql = `BEGIN;
CREATE ROLE profile_mcp_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${password}';
GRANT profile_mcp_runtime TO profile_mcp_app;
ALTER ROLE profile_mcp_app SET statement_timeout='8000ms';
ALTER ROLE profile_mcp_app SET idle_in_transaction_session_timeout='8000ms';
INSERT INTO profile_mcp.teams(id,name) VALUES('${env.AUTH_ALLOWED_TEAM_ID}','Profile MCP internal');
COMMIT;`;
await writeFile('.runtime/provision.sql', sql, { flag: 'wx' });
console.log('Created new private key material and runtime-role provisioning SQL. No secrets printed.');
