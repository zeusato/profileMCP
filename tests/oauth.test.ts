import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../src/app.js';
import { testStore, syntheticLogin } from './helpers.js';
test('OAUTH-01..06 / AUTH-01,03,08 / RUN-01,02: two-instance OAuth, PKCE, SDK and revoke', { timeout: 120000 }, async () => {
  const { db, store, settings } = await testStore(); let requests = 0; let verifyCount = 0;
  let handlers: ReturnType<typeof createApp>[] = [];
  const server = createServer((req, res) => handlers[requests++ % handlers.length]!.app(req, res));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port; settings.origin = settings.issuer = `http://127.0.0.1:${port}`; settings.resource = `${settings.origin}/api/mcp`;
  const fakeSha = { async begin(username: string) { return { username, sessionKey: 'fake-session-key', trustDevice: false, otpType: 2 as const, transactionId: 'fake-transaction', otpIndex: 'A1', expiresAt: Date.now() + 60000 }; }, async verify() { verifyCount++; return syntheticLogin(); } };
  handlers = [createApp(settings, store, fakeSha), createApp(settings, store, fakeSha)];
  const protocolErrors: string[] = [];
  for (const handler of handlers) handler.provider.on('server_error', (_ctx, error) => protocolErrors.push(String(error?.stack ?? error)));
  const cookies = new Map<string, string>();
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(new URL(path, settings.origin), { ...init, redirect: 'manual', headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...init.headers } });
    for (const header of response.headers.getSetCookie()) { const pair = header.split(';')[0]!; const at = pair.indexOf('='); cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
    return response;
  };
  const post = (path: string, values: Record<string, string>) => request(path, { method: 'POST', headers: { Origin: settings.origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values) });
  const csrf = (html: string) => { const value = /name="csrf" value="([^"]+)"/.exec(html)?.[1]; assert.ok(value, html.slice(-800)); return value; };
  const login = async () => {
    const verifier = randomBytes(32).toString('base64url'); const params = new URLSearchParams({ client_id: 'synthetic-client', redirect_uri: 'https://client.example/callback', response_type: 'code', scope: 'profile.read accounts.read', resource: settings.resource, state: 'synthetic-state', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
    let response = await request(`/auth?${params}`); assert.equal(response.status, 303, `${await response.clone().text()} ${protocolErrors.join('\n')}`);
    const interaction = response.headers.get('location')!;
    response = await request(interaction); let html = await response.text(); assert.equal(response.status, 200, html);
    response = await post(`${interaction}/login`, { csrf: csrf(html), username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' }); assert.equal(response.status, 303, await response.clone().text());
    response = await request(interaction); html = await response.text();
    response = await post(`${interaction}/verify`, { csrf: csrf(html), otp: 'FAKE_OTP_CANARY' }); assert.equal(response.status, 303, await response.clone().text());
    response = await request(interaction); html = await response.text(); assert.ok(html.includes('Cấp quyền đọc'));
    response = await post(`${interaction}/consent`, { csrf: csrf(html), decision: 'allow' });
    assert.equal(response.status, 303, await response.clone().text());
    for (let n = 0; n < 5 && response.headers.get('location') && !response.headers.get('location')!.startsWith('https://client.example'); n++) response = await request(response.headers.get('location')!);
    assert.ok(response.headers.get('location'), `status=${response.status} body=${await response.clone().text()}`);
    const callback = new URL(response.headers.get('location')!); assert.equal(callback.origin, 'https://client.example');
    assert.equal(callback.searchParams.get('state'), 'synthetic-state'); assert.equal(callback.searchParams.get('iss'), settings.issuer);
    assert.ok(callback.searchParams.get('code'), callback.toString()); return { code: callback.searchParams.get('code')!, verifier };
  };
  const exchange = (code: string, verifier: string, resource = settings.resource) => post('/token', { grant_type: 'authorization_code', client_id: 'synthetic-client', redirect_uri: 'https://client.example/callback', code, code_verifier: verifier, resource });
  try {
    const discovery = await request('/.well-known/oauth-authorization-server'); assert.equal(discovery.status, 200); const metadata = await discovery.json() as any; assert.equal(metadata.issuer, settings.issuer); assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']);
    const register = (redirect: string) => request('/reg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Synthetic registration', redirect_uris: [redirect], response_types: ['code'], grant_types: ['authorization_code', 'refresh_token'], token_endpoint_auth_method: 'none' }) });
    assert.equal((await register('https://attacker.example/callback')).status, 400);
    assert.equal((await register('http://127.0.0.1/callback')).status, 400);
    const registered = await register('https://claude.ai/api/mcp/auth_callback'); assert.equal(registered.status, 201, await registered.clone().text());
    const registration = await registered.json() as any; assert.ok(registration.client_id); assert.equal(registration.client_secret, undefined);
    const persisted = await store.get('Client', registration.client_id); assert.ok(persisted);
    const unauthorized = await request('/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(unauthorized.status, 401); assert.ok(unauthorized.headers.get('www-authenticate')?.includes('resource_metadata'));
    const first = await login();
    assert.equal((await exchange(first.code, 'x'.repeat(43))).status, 400);
    const responses = await Promise.all([exchange(first.code, first.verifier), exchange(first.code, first.verifier)]);
    const replayResults = (await Promise.all(responses.map(r => r.clone().text()))).join('\n');
    assert.equal(responses.filter(r => r.status === 200).length, 1, replayResults);
    // A replay revokes the grant; start a new connection for SDK checks.
    const second = await login(); const response = await exchange(second.code, second.verifier); const tokens = await response.json() as any; assert.equal(response.status, 200, JSON.stringify(tokens));
    assert.ok(tokens.refresh_token); assert.notEqual(tokens.access_token, 'SYNTHETIC_SHA_SECRET_CANARY');
    const rotation = await post('/token', { grant_type: 'refresh_token', client_id: 'synthetic-client', refresh_token: tokens.refresh_token, resource: settings.resource });
    const rotated = await rotation.json() as any; assert.equal(rotation.status, 200, JSON.stringify(rotated)); assert.notEqual(rotated.refresh_token, tokens.refresh_token);
    tokens.access_token = rotated.access_token; tokens.refresh_token = rotated.refresh_token;
    const client = new Client({ name: 'synthetic-sdk', version: '1' });
    const transport = new StreamableHTTPClientTransport(new URL(settings.resource), { requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } } });
    await client.connect(transport); const list = await client.listTools(); assert.equal(list.tools.length, 2);
    const result = await client.callTool({ name: 'list_profile_capabilities', arguments: {} }); assert.equal(result.isError, undefined); assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SHA_SECRET_CANARY')); await client.close();
    assert.equal(verifyCount, 2);
    const dump = await db.query<{ text: string }>("select convert_from(payload_ciphertext,'UTF8') as text from profile_mcp.oauth_artifacts");
    assert.ok(!JSON.stringify(dump.rows).includes('FAKE_PASSWORD_CANARY')); assert.ok(!JSON.stringify(dump.rows).includes('FAKE_OTP_CANARY'));
    const manage = await request('/connections'); const html = await manage.text();
    assert.equal((await post('/connections/disconnect', { csrf: csrf(html) })).status, 200);
    const revoked = await request('/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(revoked.status, 401);
    const refresh = await post('/token', { grant_type: 'refresh_token', client_id: 'synthetic-client', refresh_token: tokens.refresh_token, resource: settings.resource }); assert.equal(refresh.status, 400);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
});
