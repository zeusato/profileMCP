import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { auth, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { SCOPES } from '../src/config.js';
import { oauthHarness } from './helpers.js';
import { toolsForRelease } from '../src/mcp.js';
test('OAUTH-01..06 / AUTH-01,03,08 / RUN-01,02: two-instance OAuth, PKCE, SDK and revoke', { timeout: 120000 }, async () => {
  const h = await oauthHarness(); const { db, store, settings, request, post, csrf } = h;
  const login = async () => {
    const verifier = randomBytes(32).toString('base64url'); const params = new URLSearchParams({ client_id: 'synthetic-client', redirect_uri: 'https://client.example/callback', response_type: 'code', scope: 'profile.read accounts.read', resource: settings.resource, state: 'synthetic-state', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
    const callback = await h.approve(`/auth?${params}`, 'https://client.example');
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
    await client.connect(transport); const list = await client.listTools(); assert.deepEqual(list.tools.map(t => t.name), toolsForRelease().map(t => t.name)); assert.ok(list.tools.some(t => t.name === 'list_managed_accounts'));
    // accounts.tree without profile.pii: references and masked numbers only.
    const tree = await client.callTool({ name: 'list_managed_accounts', arguments: { operation: 'accounts.tree' } }) as any; assert.equal(tree.isError, undefined, JSON.stringify(tree));
    assert.equal(tree.structuredContent.data.accounts.length, 2); assert.ok(!/CUSTOMER CANARY|"A001"/.test(JSON.stringify(tree)));
    const result = await client.callTool({ name: 'list_profile_capabilities', arguments: {} }); assert.equal(result.isError, undefined); assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SHA_SECRET_CANARY')); await client.close();
    assert.equal(h.counters.verify, 2);
    const dump = await db.query<{ text: string }>("select convert_from(payload_ciphertext,'UTF8') as text from profile_mcp.oauth_artifacts");
    assert.ok(!JSON.stringify(dump.rows).includes('FAKE_PASSWORD_CANARY')); assert.ok(!JSON.stringify(dump.rows).includes('FAKE_OTP_CANARY'));
    const manage = await request('/connections'); const html = await manage.text();
    assert.equal((await post('/connections/disconnect', { csrf: csrf(html) })).status, 200);
    const revoked = await request('/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(revoked.status, 401);
    const refresh = await post('/token', { grant_type: 'refresh_token', client_id: 'synthetic-client', refresh_token: tokens.refresh_token, resource: settings.resource }); assert.equal(refresh.status, 400);
  } finally { await h.close(); }
});
test('OAUTH-07 / CLIENT-DCR-01: official SDK client registers with PRM scopes, consents once and calls tools', { timeout: 120000 }, async () => {
  // Mirrors the hosted Claude flow: no scope in WWW-Authenticate, so the SDK registers and authorizes with PRM scopes_supported.
  const h = await oauthHarness(); const { settings, request } = h; const serverUrl = new URL(settings.resource);
  let information: OAuthClientInformationMixed | undefined; let tokens: OAuthTokens | undefined; let verifier = ''; let authorization: URL | undefined;
  const provider: OAuthClientProvider = {
    redirectUrl: 'https://claude.ai/api/mcp/auth_callback',
    clientMetadata: { client_name: 'Claude', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' },
    state: () => 'claude-state', clientInformation: () => information, saveClientInformation: value => { information = value; },
    tokens: () => tokens, saveTokens: value => { tokens = value; }, redirectToAuthorization: url => { authorization = url; },
    saveCodeVerifier: value => { verifier = value; }, codeVerifier: () => verifier,
  };
  try {
    const warnings: string[] = []; const warn = console.warn; console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
    let rejected: Response;
    try { rejected = await request('/reg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...provider.clientMetadata, scope: 'profile.read admin.write' }) }); }
    finally { console.warn = warn; }
    assert.equal(rejected.status, 400); assert.equal((await rejected.json() as any).error, 'invalid_client_metadata');
    // SEC-06: diagnostic names fields and an allowlisted reason, never metadata values.
    assert.equal(warnings.length, 1); const diagnostic = JSON.parse(warnings[0]!);
    assert.deepEqual(diagnostic, { event: 'oauth.registration_rejected', error: 'invalid_client_metadata', reason: 'scope must only contain Authorization Server supported scope values', fields: ['client_name', 'grant_types', 'redirect_uris', 'response_types', 'scope', 'token_endpoint_auth_method'] });
    assert.ok(!warnings[0]!.includes('admin.write') && !warnings[0]!.includes('claude.ai'));
    // A client without registered scope asking for a non-read scope gets invalid_scope instead of a consent loop.
    const unsupported = new URLSearchParams({ client_id: 'synthetic-client', redirect_uri: 'https://client.example/callback', response_type: 'code', scope: 'openid profile.read', resource: settings.resource, state: 's', code_challenge: 'x'.repeat(43), code_challenge_method: 'S256' });
    let hop = await request(`/auth?${unsupported}`);
    for (let n = 0; n < 4 && !hop.headers.get('location')?.startsWith('https://client.example'); n++) hop = await request(hop.headers.get('location')!);
    assert.equal(new URL(hop.headers.get('location')!).searchParams.get('error'), 'invalid_scope'); assert.equal(h.counters.verify, 0);
    assert.equal(await auth(provider, { serverUrl }), 'REDIRECT');
    assert.ok(SCOPES.includes('profile.pii'));
    assert.ok(information?.client_id); assert.equal(authorization?.searchParams.get('scope'), SCOPES.join(' ')); assert.equal(authorization?.searchParams.get('resource'), settings.resource);
    // Scope wider than the client's registration is refused before any SHA login.
    const wider = new URL(authorization!); wider.searchParams.set('scope', `${SCOPES.join(' ')} openid`);
    const refused = await request(wider); assert.equal(refused.status, 303); assert.equal(new URL(refused.headers.get('location')!).searchParams.get('error'), 'invalid_scope');
    const callback = await h.approve(authorization!, 'https://claude.ai', { pii: true });
    assert.equal(callback.searchParams.get('state'), 'claude-state'); assert.equal(callback.searchParams.get('iss'), settings.issuer);
    assert.equal(await auth(provider, { serverUrl, authorizationCode: callback.searchParams.get('code')! }), 'AUTHORIZED');
    assert.deepEqual(tokens?.scope?.split(' ').sort(), [...SCOPES].sort()); assert.ok(tokens?.refresh_token);
    const client = new Client({ name: 'claude-shaped-sdk', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(serverUrl, { authProvider: provider }));
    assert.equal((await client.listTools()).tools.length, toolsForRelease().length);
    // With the opt-in profile.pii box ticked, the same tool returns full numbers and customer names.
    const tree = await client.callTool({ name: 'list_managed_accounts', arguments: { operation: 'accounts.tree' } }) as any;
    assert.deepEqual(tree.structuredContent.data.accounts.map((a: any) => [a.accountNumber, a.customerName]), [['A001', 'CUSTOMER CANARY'], ['A002', null]]); await client.close();
    assert.equal(h.counters.verify, 1); assert.deepEqual(h.protocolErrors, []);
  } finally { await h.close(); }
});
