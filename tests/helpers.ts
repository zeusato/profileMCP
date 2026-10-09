import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { generateKeyPair, exportJWK } from 'jose';
import type { Settings } from '../src/config.js';
import { Store } from '../src/store.js';
import { Vault } from '../src/crypto.js';
export async function testStore() {
  const db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  await db.exec(await readFile('docs/database/SCHEMA.sql', 'utf8'));
  await db.exec(await readFile('docs/database/20261009_002_runtime.sql', 'utf8'));
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const settings: Settings = {
    origin: 'http://127.0.0.1:3000', resource: 'http://127.0.0.1:3000/api/mcp', issuer: 'http://127.0.0.1:3000', databaseUrl: 'postgres://profile_mcp_runtime@localhost/test',
    environment: 'local', teamId: randomUUID(), keyring: { active: 'test', keys: { test: randomBytes(32).toString('base64url') } }, hmacKey: randomBytes(32).toString('base64url'),
    cookieKeys: [randomBytes(48).toString('base64url')], signingKeys: { keys: [{ ...await exportJWK(privateKey), kid: 'synthetic', alg: 'RS256', use: 'sig' }] },
    clients: [{ client_id: 'synthetic-client', client_name: 'Synthetic Client', redirect_uris: ['https://client.example/callback'], response_types: ['code'], grant_types: ['authorization_code', 'refresh_token'], token_endpoint_auth_method: 'none' }], liveAuth: false,
  };
  const vault = new Vault(settings.keyring, settings.hmacKey);
  const rpc = async (action: string, payload: Record<string, unknown>) => {
    const result = await db.query<{ value: any }>('SELECT profile_mcp.runtime_rpc($1,$2::jsonb) AS value', [action, JSON.stringify(payload)]); return result.rows[0]?.value;
  };
  const store = new Store(rpc, vault, settings.teamId); const userId = randomUUID();
  await db.query('INSERT INTO profile_mcp.teams(id,name) VALUES($1,$2)', [settings.teamId, 'Synthetic team']);
  await db.query('INSERT INTO profile_mcp.users(id,sha_subject_digest,identity_ciphertext,encryption_key_id) VALUES($1,decode($2,\'hex\'),$3,$4)', [userId, vault.digest('sha:preferredUsername:SYNTHETIC'), Buffer.from('synthetic'), 'test']);
  await db.query('INSERT INTO profile_mcp.memberships(team_id,user_id,role) VALUES($1,$2,\'member\')', [settings.teamId, userId]);
  return { db, settings, store, vault, userId };
}
export const syntheticIdentity = { preferredUsername: 'SYNTHETIC', brokerCodes: ['B001'] };
export const syntheticEntitlements = { accounts: [{ accountNumber: 'A001', brokerCode: 'B001' }, { accountNumber: 'A002', brokerCode: 'B001' }], brokers: [{ brokerCode: 'B001', children: [] }], subaccounts: [{ accountNo: 'A001', subId: 'INTERNAL001', subNo: '00' }] };
export function syntheticLogin() { return { bearer: 'SYNTHETIC_SHA_SECRET_CANARY', expiresAt: Date.now() + 3600000, identity: syntheticIdentity, entitlements: syntheticEntitlements }; }
