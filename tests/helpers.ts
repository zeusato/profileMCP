import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { generateKeyPair, exportJWK } from 'jose';
import type { Settings } from '../src/config.js';
import { Store } from '../src/store.js';
import { Vault } from '../src/crypto.js';
import { createApp } from '../src/app.js';
import { ShaTransport } from '../src/sha/transport.js';
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
  await db.query('INSERT INTO profile_mcp.users(id,sha_subject_digest,identity_ciphertext,encryption_key_id) VALUES($1,decode($2,\'hex\'),$3,$4)', [userId, vault.digest('sha:preferredUsername:synthetic'), Buffer.from('synthetic'), 'test']);
  await db.query('INSERT INTO profile_mcp.memberships(team_id,user_id,role) VALUES($1,$2,\'member\')', [settings.teamId, userId]);
  return { db, settings, store, vault, userId };
}
export const syntheticIdentity = { preferredUsername: 'SYNTHETIC', brokerCodes: ['B001'] };
export const syntheticEntitlements = { accounts: [{ accountNumber: 'A001', brokerCode: 'B001' }, { accountNumber: 'A002', brokerCode: 'B001' }], brokers: [{ brokerCode: 'B001', children: [] }], subaccounts: [{ accountNo: 'A001', subId: 'INTERNAL001', subNo: '00' }] };
export function syntheticLogin() { return { bearer: 'SYNTHETIC_SHA_SECRET_CANARY', expiresAt: Date.now() + 3600000, identity: syntheticIdentity, entitlements: syntheticEntitlements }; }
// Round-robin HTTP over several app instances sharing one store; fake SHA, browser cookie jar and form helpers.
export async function oauthHarness(instances = 2) {
  const { db, store, settings } = await testStore(); let requests = 0; const counters = { begin: 0, verify: 0 };
  let handlers: ReturnType<typeof createApp>[] = [];
  const server = createServer((req, res) => handlers[requests++ % handlers.length]!.app(req, res));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port; settings.origin = settings.issuer = `http://127.0.0.1:${port}`; settings.resource = `${settings.origin}/api/mcp`;
  const fakeSha = { async begin(username: string) { counters.begin++; return { username, sessionKey: 'fake-session-key', trustDevice: false, otpType: 2 as const, transactionId: 'fake-transaction', otpIndex: 'A1', expiresAt: Date.now() + 60000 }; }, async verify() { counters.verify++; return syntheticLogin(); } };
  // Fake SHA read gateway for released operations (identity + account tree); never reaches the network.
  const shaJson = (data: unknown) => new Response(JSON.stringify({ code: 200, message: 'ok', data }), { headers: { 'Content-Type': 'application/json' } });
  const reads = new ShaTransport((async (url: unknown) => new URL(String(url)).pathname.endsWith('/cms/departments') ? new Response(JSON.stringify({ data: [{ Code: 'X1' }] }), { headers: { 'Content-Type': 'application/json' } })
    : new URL(String(url)).pathname.endsWith('/knowledge-shares/department/X1') ? new Response(JSON.stringify({ data: [{ id: 1, Content: '<img src="https://example.com/body.webp"><a href="https://example.com/rules.pdf">Rules</a>', Photo: { url: 'https://example.com/cover.webp' } }], meta: { pagination: { page: 1, pageSize: 50, pageCount: 1, total: 1 } } }), { headers: { 'Content-Type': 'application/json' } })
    : String(url).endsWith('get-user-login') ? shaJson([{ preferredUsername: 'SYNTHETIC', brokerCode: 'B001', branchCode: 'BR1' }])
    : shaJson({ accounts: [{ accountNumber: 'A001', customerName: 'CUSTOMER CANARY', brokerCode: 'B001', remNo: 'B001' }, { accountNumber: 'A002', customerName: null, brokerCode: 'B001', remNo: 'B001' }], brokers: [{ brokerCode: 'B001', brokerName: 'ROOT CANARY', children: [] }] })) as typeof fetch);
  handlers = Array.from({ length: instances }, () => createApp(settings, store, fakeSha, reads));
  const protocolErrors: string[] = [];
  for (const handler of handlers) handler.provider.on('server_error', (_ctx, error) => protocolErrors.push(String(error?.stack ?? error)));
  // oidc-provider uses the same cookie name at different interaction paths.
  // A name-only jar overwrites those cookies and cannot reproduce multiple browser tabs.
  const cookies = new Map<string, { name: string; value: string; path: string }>();
  const cookiesFor = (path: string | URL) => {
    const url = new URL(path, settings.origin);
    return [...cookies.values()].filter(c => url.pathname === c.path || url.pathname.startsWith(c.path.endsWith('/') ? c.path : `${c.path}/`))
      .sort((a, b) => b.path.length - a.path.length).map(c => `${c.name}=${c.value}`).join('; ');
  };
  const request = async (path: string | URL, init: RequestInit = {}) => {
    const url = new URL(path, settings.origin);
    const response = await fetch(url, { ...init, redirect: 'manual', headers: { Cookie: cookiesFor(url), ...init.headers } });
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(';')[0]!; const at = pair.indexOf('='); const name = pair.slice(0, at);
      const cookiePath = /;\s*path=([^;]+)/i.exec(header)?.[1] ?? '/'; const key = `${name}:${cookiePath}`;
      if (/;\s*max-age=0(?:;|$)/i.test(header) || /;\s*expires=Thu, 01 Jan 1970/i.test(header)) cookies.delete(key);
      else cookies.set(key, { name, value: pair.slice(at + 1), path: cookiePath });
    }
    return response;
  };
  const post = (path: string, values: Record<string, string>) => request(path, { method: 'POST', headers: { Origin: settings.origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values) });
  const csrf = (html: string) => { const value = /name="csrf" value="([^"]+)"/.exec(html)?.[1]; assert.ok(value, html.slice(-800)); return value; };
  // Browser leg: authorization URL → SHA login → OTP → consent → client callback. Fails if consent is requested twice.
  const approve = async (authorization: string | URL, redirectOrigin: string, { pii = false } = {}) => {
    let response = await request(authorization); assert.equal(response.status, 303, `${await response.clone().text()} ${protocolErrors.join('\n')}`);
    const interaction = response.headers.get('location')!;
    response = await request(interaction); let html = await response.text(); assert.equal(response.status, 200, html);
    // Browsers serialize Origin as "null" on form POSTs under no-referrer; the page policy must keep same-origin Origin, and null stays rejected.
    assert.equal(response.headers.get('referrer-policy'), 'same-origin'); assert.ok(response.headers.get('content-security-policy')!.includes("form-action 'self';"));
    assert.equal((await request(`${interaction}/login`, { method: 'POST', headers: { Origin: 'null', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf: csrf(html), username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' }) })).status, 403);
    response = await post(`${interaction}/login`, { csrf: csrf(html), username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' }); assert.equal(response.status, 303, await response.clone().text());
    response = await request(interaction); html = await response.text();
    response = await post(`${interaction}/verify`, { csrf: csrf(html), otp: 'FAKE_OTP_CANARY' }); assert.equal(response.status, 303, await response.clone().text());
    response = await request(interaction); html = await response.text(); assert.ok(html.includes('Cấp quyền đọc'));
    // Chrome applies form-action to the post-consent redirect chain; only the consent page adds the client's redirect origin.
    assert.ok(response.headers.get('content-security-policy')!.includes(`form-action 'self' ${redirectOrigin};`), response.headers.get('content-security-policy')!);
    // profile.pii is opt-in: offered only when requested, never pre-checked.
    if (new URL(authorization, settings.origin).searchParams.get('scope')?.split(' ').includes('profile.pii')) { assert.ok(html.includes('name="pii"')); assert.ok(!/name="pii"[^>]*checked/.test(html)); } else assert.ok(!html.includes('name="pii"'));
    response = await post(`${interaction}/consent`, { csrf: csrf(html), decision: 'allow', ...(pii ? { pii: '1' } : {}) });
    assert.equal(response.status, 303, await response.clone().text());
    for (let n = 0; n < 5 && response.headers.get('location') && !response.headers.get('location')!.startsWith(redirectOrigin); n++) response = await request(response.headers.get('location')!);
    assert.ok(response.headers.get('location'), `status=${response.status} body=${await response.clone().text()}`);
    const callback = new URL(response.headers.get('location')!); assert.equal(callback.origin, redirectOrigin); return callback;
  };
  const close = async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); };
  return { db, store, settings, handlers, protocolErrors, counters, fakeSha, request, post, csrf, approve, close, cookiesFor };
}
