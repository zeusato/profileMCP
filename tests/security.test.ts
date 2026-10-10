import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { Vault } from '../src/crypto.js';
import { Policy, parseEntitlements, parseIdentity } from '../src/policy.js';
import { routes, isEnabled } from '../src/sha/catalog.js';
import { ShaTransport, boundedJson, envelope } from '../src/sha/transport.js';
import { ShaAuth } from '../src/sha/auth.js';
import { toolsForRelease } from '../src/mcp.js';
import { testStore, syntheticLogin, syntheticEntitlements, syntheticIdentity } from './helpers.js';

test('DB-03 / OAUTH-05: atomic consume across two stores; expiry and revoke fence', async () => {
  const { db, store, vault, settings, userId } = await testStore();
  try {
    const second = new Store(store.rpc, vault, settings.teamId);
    await store.put('AuthorizationCode', 'fake-code', { grantId: 'fake-grant', canary: 'SYNTHETIC' }, 60);
    const consumed = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? store : second).consume('AuthorizationCode', 'fake-code')));
    assert.equal(consumed.filter(Boolean).length, 1); assert.ok((await second.get('AuthorizationCode', 'fake-code'))?.consumed);
    await store.put('AuthorizationCode', 'fake-code', { grantId: 'fake-grant' }, 60);
    assert.equal(await store.consume('AuthorizationCode', 'fake-code'), false, 'upsert cannot resurrect used codes');
    const s = await store.createSession({ ...syntheticLogin(), userId, clientId: 'synthetic-client', grantId: 'fake-grant', scopes: ['profile.read'], resource: settings.resource });
    assert.equal((await second.session(s.id)).bearer, 'SYNTHETIC_SHA_SECRET_CANARY');
    await second.revoke(s); await assert.rejects(store.fence(s), /REAUTH_REQUIRED/);
    const row = await db.query<{ token_ciphertext: unknown }>('select token_ciphertext from profile_mcp.upstream_sessions where id=$1', [s.id]); assert.equal(row.rows[0]?.token_ciphertext, null);
    assert.equal(await store.get('AuthorizationCode', 'fake-code'), undefined);
    await store.put('Interaction', 'expired', {}, 60); await db.exec("update profile_mcp.oauth_artifacts set expires_at=now()-interval '1 second'");
    assert.equal(await store.get('Interaction', 'expired'), undefined);
  } finally { await db.close(); }
});
test('SEC-05: AEAD random nonce, AAD isolation, key rotation and tamper failure', () => {
  const old = Buffer.alloc(32, 1).toString('base64url'), fresh = Buffer.alloc(32, 2).toString('base64url');
  const vault = new Vault({ active: 'old', keys: { old } }, fresh); const a = vault.seal({ bearer: 'fake' }, 'row:a'); const b = vault.seal({ bearer: 'fake' }, 'row:a');
  assert.notEqual(a, b); assert.deepEqual(new Vault({ active: 'new', keys: { old, new: fresh } }, fresh).open(a, 'row:a'), { bearer: 'fake' });
  assert.throws(() => vault.open(a, 'row:b'), /STORE_UNAVAILABLE/); assert.throws(() => vault.open(a.replace('"v":1', '"v":2'), 'row:a'));
});
test('SEC-02 / SEC-03: unreleased catalog and every mutation blocked with zero network', async () => {
  let network = 0; const sha = new ShaTransport((async () => { network++; throw new Error(); }) as typeof fetch);
  for (const r of routes.filter(r => !isEnabled(r.id))) await assert.rejects(sha.read({ operation: r.id, method: r.method, path: r.path, query: {}, accountNos: [] }, 'fake'), /CAPABILITY_UNAVAILABLE/);
  for (const path of ['/order/buy/create', '/order/sell/create', '/order/modify', '/order/cancel', '/auth/login-v2', 'https://evil.example']) await assert.rejects(sha.read({ operation: path, method: 'POST', path, query: {}, accountNos: [] }, 'fake'));
  assert.equal(network, 0);
  const released = new Set(routes.filter(r => isEnabled(r.id)).map(r => r.tool));
  assert.deepEqual(toolsForRelease().map(t => t.name), ['list_profile_capabilities', 'get_profile_data_dictionary', ...released]);
  // Path placeholders take a single validated token only; traversal or encoded separators are refused before any network.
  const kms = routes.find(r => r.id === 'knowledge.documents')!;
  for (const department of ['../x', 'a/b', '%2e%2e', 'a.b']) await assert.rejects((sha as any).checkedRead({ operation: kms.id, method: kms.method, path: kms.path, query: {}, accountNos: [], pathParams: { department } }, 'fake'), /INVALID_INPUT/);
  assert.equal(network, 0);
  // Released tools expose one object schema (no top-level oneOf/anyOf/allOf) and stay read-only.
  for (const tool of toolsForRelease()) { assert.equal(tool.inputSchema.type, 'object'); assert.ok(!['oneOf', 'anyOf', 'allOf'].some(k => k in tool.inputSchema)); assert.equal(tool.annotations?.readOnlyHint, true); }
});
test('SEC-04: subject-bound references, account/subaccount scope, nested response drift', () => {
  const vault = new Vault({ active: 'k', keys: { k: Buffer.alloc(32).toString('base64url') } }, Buffer.alloc(32, 2).toString('base64url'));
  const session = { ...syntheticLogin(), id: 'session-a', userId: 'user-a', teamId: 'team', generation: 1, clientId: 'c', grantId: 'g', scopes: [], resource: 'r' };
  const p = new Policy(session, vault, syntheticEntitlements); const q = new Policy({ ...session, userId: 'user-b' }, vault, syntheticEntitlements);
  const ref = p.ref('acct', 'A001'); assert.equal(p.account(ref).accountNumber, 'A001'); assert.throws(() => q.account(ref), /FORBIDDEN_SCOPE/);
  assert.throws(() => p.subaccount(p.ref('sub', 'INTERNAL001'), 'A002'), /FORBIDDEN_SCOPE/);
  assert.throws(() => p.checkResponse({ data: [{ children: [{ accountNo: 'FOREIGN' }] }] }), /FORBIDDEN_SCOPE/);
  assert.throws(() => p.checkResponse({ accountNumber: 'A002' }, ['A001']), /FORBIDDEN_SCOPE/);
  assert.throws(() => parseIdentity([{ preferredUsername: 'EVIL', brokerCode: 'B001' }], 'SYNTHETIC'));
  // Live 10/10/2026: typed login case differs from SHA's canonical preferredUsername; identity keeps SHA's value, mixed rows still fail.
  assert.equal(parseIdentity([{ preferredUsername: 'SYNTHETIC', brokerCode: 'B001' }], 'synthetic').preferredUsername, 'SYNTHETIC');
  assert.throws(() => parseIdentity([{ preferredUsername: 'SYNTHETIC', brokerCode: 'B001' }, { preferredUsername: 'synthetic', brokerCode: 'B001' }], 'synthetic'));
  assert.throws(() => parseEntitlements({ accounts: [], brokers: [{ brokerCode: 'B001', children: [{ brokerCode: 'B001', children: [] }] }] }, syntheticIdentity));
});
test('RAW / SEC-01: auth envelope, content type, size and redirect errors do not leak body', async () => {
  assert.throws(() => envelope({ code: 401, data: [] }), /UPSTREAM_AUTH_FAILED/); assert.throws(() => envelope({ code: 0, data: [] }), /UPSTREAM_REJECTED/);
  assert.equal(envelope({ code: '200', data: null }), null);
  await assert.rejects(boundedJson(new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } })));
  await assert.rejects(boundedJson(new Response(JSON.stringify('x'.repeat(2 * 1024 * 1024)), { headers: { 'Content-Type': 'application/json' } })));
});
test('SEC-06 / AUTH-02: SHA control-plane diagnostics carry status and shape only, never values', async () => {
  const responses: (() => Response | Promise<Response>)[] = [
    () => new Response(JSON.stringify({ code: 401, message: 'CANARY_MESSAGE', username: 'CANARY_USER' }), { status: 401, headers: { 'Content-Type': 'application/json' } }),
    () => new Response('<html>CANARY_WAF</html>', { status: 403, headers: { 'Content-Type': 'text/html' } }),
    () => new Response(JSON.stringify({ code: '400', message: 'CANARY_MESSAGE', data: { sessionKey: 'CANARY_SESSION' } }), { headers: { 'Content-Type': 'application/json' } }),
    () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }); },
  ];
  const bodies: string[] = []; const authorization: unknown[] = []; let call = 0;
  const transport = new ShaTransport((async (_url: unknown, init?: RequestInit) => { bodies.push(String(init?.body)); authorization.push((init?.headers as Record<string, string>)?.Authorization); return responses[call++]!(); }) as typeof fetch);
  const lines: string[] = []; const warn = console.warn; console.warn = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
  try {
    await assert.rejects(transport.auth('login-v2', { username: 'CANARY_USER', password: 'FAKE_PASSWORD_CANARY' }), /UPSTREAM_AUTH_FAILED/);
    await assert.rejects(transport.auth('login-v2', { username: 'CANARY_USER', password: 'FAKE_PASSWORD_CANARY' }), /UPSTREAM_AUTH_FAILED/);
    await assert.rejects(transport.auth('generate-matrix', { username: 'CANARY_USER', sessionKey: 'CANARY-SESSION', trustDevice: false, otpType: [2] }), /UPSTREAM_REJECTED/);
    await assert.rejects(transport.bootstrap('identity.current', 'CANARY_BEARER'), /UPSTREAM_REJECTED/);
  } finally { console.warn = warn; }
  assert.ok(bodies[0]!.includes('FAKE_PASSWORD_CANARY'));
  // Public auth mirrors the official web client header; bootstrap carries the session bearer.
  assert.deepEqual(authorization, ['Bearer null', 'Bearer null', 'Bearer null', 'Bearer CANARY_BEARER']);
  assert.deepEqual(lines.map(l => { const { ms, ...rest } = JSON.parse(l); assert.equal(typeof ms, 'number'); return rest; }), [
    { event: 'sha.upstream', step: 'login-v2', httpStatus: 401, contentType: 'json', envelopeCode: '401', envelopeStatus: null, keys: ['code', 'message', 'username'], outcome: 'UPSTREAM_AUTH_FAILED', cause: null },
    { event: 'sha.upstream', step: 'login-v2', httpStatus: 403, contentType: 'html', envelopeCode: null, envelopeStatus: null, keys: [], outcome: 'UPSTREAM_AUTH_FAILED', cause: null },
    { event: 'sha.upstream', step: 'generate-matrix', httpStatus: 200, contentType: 'json', envelopeCode: '400', envelopeStatus: null, keys: ['code', 'message', 'data'], outcome: 'received', cause: null },
    { event: 'sha.upstream', step: 'identity.current', httpStatus: null, contentType: 'none', envelopeCode: null, envelopeStatus: null, keys: [], outcome: 'UPSTREAM_REJECTED', cause: 'ENOTFOUND' },
  ]);
  assert.ok(!/CANARY/.test(lines.join('\n')));
  // Schema mismatch names the field and value kind only.
  lines.length = 0; console.warn = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
  const json = (data: unknown) => new Response(JSON.stringify({ code: 200, data }), { headers: { 'Content-Type': 'application/json' } });
  const login = new ShaAuth(new ShaTransport((async () => json({ username: 'CANARY_USER', sessionKey: 'CANARY_SESSION', trustDevice: null, otpType: 2 })) as typeof fetch), true);
  try { await assert.rejects(login.begin('CANARY_USER', 'FAKE_PASSWORD_CANARY'), /UPSTREAM_SHAPE_CHANGED/); } finally { console.warn = warn; }
  assert.deepEqual(JSON.parse(lines[1]!), { event: 'sha.shape_mismatch', step: 'login-v2', issues: [{ path: 'otpType', code: 'invalid_type', received: 'number' }] });
  assert.ok(!/CANARY/.test(lines.join('\n')));
  // AUTH-01 live shape (10/10/2026): login-v2 trustDevice null is accepted and forwarded unchanged to generate-matrix.
  const sent: unknown[] = []; const sessionHeaders: unknown[] = []; const steps = [json({ username: 'SYNTHETIC', sessionKey: 'fake-session-key', trustDevice: null, otpType: [2] }), json({ username: 'SYNTHETIC', otpIndex: 'A1', transactionId: 'fake-transaction', remainSeconds: 120 })];
  const nullTrust = new ShaAuth(new ShaTransport((async (_url: unknown, init?: RequestInit) => { sent.push(JSON.parse(String(init?.body))); sessionHeaders.push((init?.headers as Record<string, string>)['Session-Key']); return steps.shift()!; }) as typeof fetch), true);
  console.warn = () => {};
  try { const challenge = await nullTrust.begin('SYNTHETIC', 'FAKE_PASSWORD_CANARY'); assert.equal(challenge.trustDevice, null); assert.equal(challenge.transactionId, 'fake-transaction'); } finally { console.warn = warn; }
  assert.deepEqual(sent[1], { username: 'SYNTHETIC', sessionKey: 'fake-session-key', trustDevice: null, otpType: [2] });
  // Live 10/10/2026: generate-matrix needs the login sessionKey as Session-Key header too (else code 405); login-v2 has none.
  assert.deepEqual(sessionHeaders, [undefined, 'fake-session-key']);
});
test('DB-02 / DB-03: runtime is EXECUTE-only; quota has one atomic budget', async () => {
  const { db, store } = await testStore();
  try {
    const privileges = await db.query<{ allowed: boolean }>("select has_table_privilege('profile_mcp_runtime','profile_mcp.users','SELECT') as allowed"); assert.equal(privileges.rows[0]?.allowed, false);
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => store.quota('shared', 5)));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 5);
    await db.exec('SET ROLE profile_mcp_runtime');
    await assert.rejects(db.query('select * from profile_mcp.users'), /permission denied/);
    assert.ok(await store.rpc('health', {}));
    await db.exec('RESET ROLE');
  } finally { await db.close(); }
});
