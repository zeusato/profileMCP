import { readFile, writeFile } from 'node:fs/promises';
import { X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const source = 'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt';
const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(10000) });
if (!response.ok) throw new Error('Official CA download failed');
const pem = await response.text(); const cert = new X509Certificate(pem);
if (!cert.ca || !cert.subject.includes('Supabase Root 2021 CA') || !cert.verify(cert.publicKey)) throw new Error('Unexpected CA certificate');
const env = JSON.parse(await readFile('.runtime/env.production.json', 'utf8'));
env.APP_ORIGIN = env.OAUTH_ISSUER = 'https://profile-mcp.vercel.app'; env.MCP_RESOURCE_URL = `${env.APP_ORIGIN}/api/mcp`; env.DATABASE_CA_CERT = pem;
await writeFile('.runtime/env.production.json', JSON.stringify(env));
await writeFile('config/database-ca-provenance.json', JSON.stringify({ source, sourceCode: 'https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json', fingerprint256: cert.fingerprint256, checkedAt: new Date().toISOString() }, null, 2));
for (const [key, value] of Object.entries(env)) {
  const sensitive = /DATABASE_URL|KEY|COOKIE_SECRET/.test(key);
  try { execFileSync(process.execPath, ['node_modules/vercel/dist/index.js', 'env', 'add', key, 'production', '--force', '--yes', sensitive ? '--sensitive' : '--no-sensitive'], { input: value, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch { throw new Error(`Failed to configure ${key}; secret output withheld`); }
  console.log(`Configured ${key}`);
}
