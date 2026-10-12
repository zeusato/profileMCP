import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Vault } from '../src/crypto.js';
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--sql-only') || args.length > 1) throw new Error('Usage: add-member.ts [--sql-only]');
const sqlOnly = args.includes('--sql-only');
const env = JSON.parse(await readFile('.runtime/env.production.json', 'utf8'));
const vault = new Vault(JSON.parse(env.SESSION_ENCRYPTION_KEYRING), env.TOKEN_HMAC_KEY);
const reader = createInterface({ input: stdin, output: stdout });
// Allowlist subjects are lowercase (SHA IDs are case-insensitive; see Store.member).
const username = (await reader.question('Dai ca nhap ID SHA can cap quyen (khong nhap mat khau/OTP): ')).trim().toLowerCase(); reader.close();
if (!/^[A-Za-z0-9_.-]{1,100}$/.test(username)) throw new Error('ID format invalid');
const id = randomUUID(); const cipher = vault.seal({ onboarding: 'allowlist-pending-authoritative-login' }, `user:${id}:${env.AUTH_ALLOWED_TEAM_ID}`);
const sql = `BEGIN;
INSERT INTO profile_mcp.users(id,sha_subject_digest,identity_ciphertext,encryption_key_id)
VALUES('${id}',decode('${vault.digest(`sha:preferredUsername:${username}`)}','hex'),decode('${Buffer.from(cipher).toString('hex')}','hex'),'${vault.keyId}')
ON CONFLICT(sha_subject_digest) DO NOTHING;
INSERT INTO profile_mcp.memberships(team_id,user_id,role)
SELECT '${env.AUTH_ALLOWED_TEAM_ID}',id,'member' FROM profile_mcp.users WHERE sha_subject_digest=decode('${vault.digest(`sha:preferredUsername:${username}`)}','hex')
ON CONFLICT(team_id,user_id) DO UPDATE SET status='active';
COMMIT;
SELECT profile_mcp.runtime_rpc('member.get', jsonb_build_object('teamId','${env.AUTH_ALLOWED_TEAM_ID}','subject','${vault.digest(`sha:preferredUsername:${username}`)}')) IS NOT NULL AS profile_mcp_access_enabled;`;
await writeFile('.runtime/member.sql', sql);
if (sqlOnly) console.log('Em da tao .runtime/member.sql, CHUA ghi database. Dai ca chon dung project Digital16, mo SQL Editor va chay file nay. Ket qua profile_mcp_access_enabled phai la true. Khong chia se file SQL hoac dua vao Git.');
else {
  try { execFileSync(process.execPath, ['scripts/apply-private-sql.mjs', '.runtime/member.sql'], { stdio: ['ignore', 'pipe', 'pipe'] }); console.log('Da them allowlist. Dai ca co the dang nhap SHA tren website.'); }
  catch { console.log('Chua them duoc allowlist; em se kiem tra loi.'); process.exitCode = 1; }
}
