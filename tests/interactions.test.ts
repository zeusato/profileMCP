import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { oauthHarness } from './helpers.js';
import { AppError } from '../src/errors.js';

async function start(h: Awaited<ReturnType<typeof oauthHarness>>) {
  const params = new URLSearchParams({ client_id: 'synthetic-client', redirect_uri: 'https://client.example/callback', response_type: 'code', scope: 'profile.read', resource: h.settings.resource, state: randomBytes(16).toString('hex'), code_challenge: createHash('sha256').update(randomBytes(32)).digest('base64url'), code_challenge_method: 'S256' });
  const response = await h.request(`/auth?${params}`);
  assert.equal(response.status, 303);
  const path = response.headers.get('location')!;
  const page = await h.request(path); assert.equal(page.status, 200);
  return { path, csrf: h.csrf(await page.text()) };
}

test('AUTH-FLOW-01: two browser interactions keep independent login, OTP and consent flows across instances', { timeout: 120000 }, async () => {
  const h = await oauthHarness();
  try {
    const first = await start(h); const second = await start(h);
    assert.notEqual(first.path, second.path);
    for (const flow of [first, second]) {
      const response = await h.post(`${flow.path}/login`, { csrf: flow.csrf, username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' });
      assert.equal(response.status, 303, await response.clone().text());
    }
    assert.equal(h.counters.begin, 2);
    for (const flow of [first, second]) {
      const otp = await h.request(flow.path); const html = await otp.text();
      assert.ok(html.includes('name="otp"'));
      const response = await h.post(`${flow.path}/verify`, { csrf: h.csrf(html), otp: 'FAKE_OTP_CANARY' });
      assert.equal(response.status, 303, await response.clone().text());
    }
    assert.equal(h.counters.verify, 2);
    const firstConsent = await h.request(first.path); const firstHtml = await firstConsent.text();
    const secondConsent = await h.request(second.path); const secondHtml = await secondConsent.text();
    assert.ok(firstHtml.includes('Cấp quyền đọc')); assert.ok(secondHtml.includes('Cấp quyền đọc'));
    assert.equal((await h.post(`${second.path}/consent`, { csrf: h.csrf(secondHtml), decision: 'deny' })).status, 303);
    assert.equal((await h.post(`${first.path}/consent`, { csrf: h.csrf(firstHtml), decision: 'allow' })).status, 303);
  } finally { await h.close(); }
});

test('AUTH-FLOW-02: missing, expired, mismatched and replayed flows fail before SHA; diagnostics contain no secrets', { timeout: 120000 }, async t => {
  const h = await oauthHarness(); const logs: string[] = [];
  t.mock.method(console, 'warn', (line: string) => logs.push(line));
  const submit = (flow: { path: string; csrf: string }, cookies: string, csrf = flow.csrf) => h.request(`${flow.path}/login`, {
    method: 'POST', headers: { Origin: h.settings.origin, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies },
    body: new URLSearchParams({ csrf, username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' }),
  });
  const reason = () => JSON.parse(logs.at(-1)!).reason;
  try {
    const first = await start(h); const firstCookies = h.cookiesFor(first.path);
    const flowPair = firstCookies.split('; ').find(c => c.startsWith('profile_flow_'))!;
    assert.ok(flowPair);
    const missing = await submit(first, firstCookies.split('; ').filter(c => c !== flowPair).join('; '));
    assert.equal(missing.status, 400); assert.equal(reason(), 'flow_cookie_missing');
    const html = await missing.text(); assert.ok(html.includes(`href="${first.path}"`));
    assert.ok(!html.includes('OTP đã gửi')); assert.ok(html.includes(missing.headers.get('x-request-id')!));
    assert.equal((await submit(first, '')).status, 400); assert.equal(reason(), 'provider_session_missing');

    const second = await start(h); const secondCookies = h.cookiesFor(second.path);
    const secondPair = secondCookies.split('; ').find(c => c.startsWith('profile_flow_') && c !== flowPair)!;
    const firstHandle = flowPair.split('=')[1]!; const secondHandle = secondPair.split('=')[1]!;
    const swapped = firstCookies.replace(firstHandle, secondHandle);
    assert.equal((await submit(first, swapped)).status, 400); assert.equal(reason(), 'flow_mismatch');
    // Legacy migration must not bypass UID binding either.
    const legacy = firstCookies.replace(flowPair, `profile_flow=${secondHandle}`);
    assert.equal((await submit(first, legacy)).status, 400); assert.equal(reason(), 'flow_mismatch');
    await h.store.destroy('ShaFlow', secondHandle);
    assert.equal((await submit(second, secondCookies)).status, 400); assert.equal(reason(), 'flow_expired');
    assert.equal((await submit(first, firstCookies, 'WRONG_CSRF')).status, 403);
    assert.equal(h.counters.begin, 0);

    const responses = await Promise.all([submit(first, firstCookies), submit(first, firstCookies)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [303, 400]);
    assert.equal(h.counters.begin, 1); assert.equal(h.counters.verify, 0);
    const replay = await submit(first, firstCookies); assert.equal(replay.status, 400);
    assert.equal(h.counters.begin, 1);
    for (const line of logs) {
      const event = JSON.parse(line);
      assert.deepEqual(Object.keys(event).sort(), ['error', 'event', 'reason', 'requestId', 'step']);
      assert.equal(event.event, 'oauth.interaction_failed'); assert.equal(event.step, 'login');
      for (const secret of [firstHandle, secondHandle, first.csrf, first.path, 'SYNTHETIC', 'FAKE_PASSWORD_CANARY', 'FAKE_OTP_CANARY']) assert.ok(!line.includes(secret));
    }
    // Rejected stale requests must not invalidate the winning request's OTP flow.
    const otp = await h.request(first.path); assert.ok((await otp.text()).includes('name="otp"'));
  } finally { await h.close(); }
});

test('AUTH-FLOW-05: failed or expired OTP returns to login, and explicit restart discards the old challenge', { timeout: 120000 }, async t => {
  const h = await oauthHarness(); let scenario = '';
  t.mock.method(console, 'warn', () => {});
  t.mock.method(h.fakeSha, 'verify', async () => { h.counters.verify++; throw new AppError(scenario === 'rejected' ? 'UPSTREAM_AUTH_FAILED' : 'UPSTREAM_TIMEOUT', 502); });
  try {
    for (scenario of ['timeout', 'rejected', 'expired', 'restart']) {
      const flow = await start(h);
      assert.equal((await h.post(`${flow.path}/login`, { csrf: flow.csrf, username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' })).status, 303);
      const html = await (await h.request(flow.path)).text(); assert.ok(html.includes(`${flow.path}/restart`));
      const oldCookies = h.cookiesFor(flow.path);
      const pair = oldCookies.split('; ').find(c => c.startsWith(`profile_flow_${h.store.vault.digest(`flow-cookie:${flow.path.split('/').at(-1)}`)}=`))!;
      const handle = pair.split('=')[1]!;
      if (scenario === 'expired') {
        const saved = (await h.store.get('ShaFlow', handle))!; saved.challenge.expiresAt = Date.now() - 1;
        await h.store.put('ShaFlow', handle, saved, 600);
      }
      const response = await h.post(`${flow.path}/${scenario === 'restart' ? 'restart' : 'verify'}`, { csrf: h.csrf(html), ...(scenario === 'restart' ? {} : { otp: 'FAKE_OTP_CANARY' }) });
      assert.equal(response.status, 303); assert.equal(response.headers.get('location'), flow.path);
      assert.equal(await h.store.get('ShaFlow', handle), undefined);
      const loginHtml = await (await h.request(flow.path)).text(); assert.ok(loginHtml.includes('name="password"')); assert.ok(!loginHtml.includes('name="otp"'));
      assert.notEqual(h.csrf(loginHtml), h.csrf(html));
      if (scenario !== 'restart') assert.ok(loginHtml.includes('mã xác thực mới'));
      const replay = await h.request(`${flow.path}/verify`, { method: 'POST', headers: { Origin: h.settings.origin, Cookie: oldCookies, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf: h.csrf(html), otp: 'FAKE_OTP_CANARY' }) });
      assert.equal(replay.status, 400);
    }
    assert.equal(h.counters.begin, 4); assert.equal(h.counters.verify, 2);
  } finally { await h.close(); }
});

test('AUTH-FLOW-06: login retry cannot bypass the shared per-user quota by opening a new interaction', { timeout: 120000 }, async t => {
  const h = await oauthHarness();
  t.mock.method(console, 'warn', () => {});
  t.mock.method(h.fakeSha, 'begin', async () => { h.counters.begin++; throw new AppError('UPSTREAM_AUTH_FAILED', 401); });
  try {
    const first = await start(h); let csrf = first.csrf;
    for (let attempt = 0; attempt < 5; attempt++) {
      assert.equal((await h.post(`${first.path}/login`, { csrf, username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' })).status, 303);
      csrf = h.csrf(await (await h.request(first.path)).text());
    }
    for (const flow of [{ path: first.path, csrf }, await start(h)]) {
      assert.equal((await h.post(`${flow.path}/login`, { csrf: flow.csrf, username: 'synthetic', password: 'FAKE_PASSWORD_CANARY' })).status, 303);
      const html = await (await h.request(flow.path)).text(); assert.ok(html.includes('RATE_LIMITED')); assert.ok(html.includes('10 phút'));
    }
    assert.equal(h.counters.begin, 5);
  } finally { await h.close(); }
});

test('AUTH-FLOW-07: allowlist, CSRF and authorization mismatch are distinguished; provider expiry and store failure fail closed', { timeout: 120000 }, async t => {
  const h = await oauthHarness(); const logs: string[] = [];
  t.mock.method(console, 'warn', (line: string) => logs.push(line));
  const last = () => JSON.parse(logs.at(-1)!);
  try {
    const flow = await start(h);
    const rejected = await h.post(`${flow.path}/login`, { csrf: flow.csrf, username: 'NOT_ALLOWED_CANARY', password: 'FAKE_PASSWORD_CANARY' });
    assert.equal(rejected.status, 303); assert.equal(last().reason, 'member_not_allowed');
    const html = await (await h.request(flow.path)).text(); assert.ok(html.includes('chưa được cấp quyền'));
    const csrf = h.csrf(html);
    assert.equal((await h.post(`${flow.path}/login`, { csrf: 'OLD_CSRF', username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' })).status, 403);
    assert.equal(last().reason, 'csrf_mismatch');
    assert.equal(h.csrf(await (await h.request(flow.path)).text()), csrf);
    const handle = h.cookiesFor(flow.path).split('; ').find(c => c.startsWith('profile_flow_'))!.split('=')[1]!;
    const saved = (await h.store.get('ShaFlow', handle))!;
    await h.store.put('ShaFlow', handle, { ...saved, clientId: 'FORGED_CLIENT' }, 600);
    assert.equal((await h.post(`${flow.path}/login`, { csrf, username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' })).status, 403);
    assert.equal(last().reason, 'authorization_mismatch');
    await h.store.put('ShaFlow', handle, saved, 600);
    const missingProvider = await h.request(`${flow.path}/login`, { method: 'POST', headers: { Origin: h.settings.origin, Cookie: '', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' }) });
    assert.equal(missingProvider.status, 400); assert.ok(!(await missingProvider.text()).includes('class="button"'));
    assert.equal(last().reason, 'provider_session_missing');
    t.mock.method(h.store, 'member', async () => { throw new AppError('STORE_UNAVAILABLE', 503); });
    const unavailable = await h.post(`${flow.path}/login`, { csrf, username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' });
    assert.equal(unavailable.status, 503); assert.ok(!unavailable.headers.getSetCookie().some(c => c.startsWith('profile_flow_')));
    assert.equal(await h.store.get('ShaFlow', handle), undefined);
    assert.equal(h.counters.begin, 0);
    for (const secret of ['NOT_ALLOWED_CANARY', 'FAKE_PASSWORD_CANARY', 'FORGED_CLIENT', csrf, handle]) assert.ok(!logs.join('').includes(secret));
  } finally { await h.close(); }
});

test('AUTH-FLOW-08: concurrent failed submits and a GET during processing cannot replace the claimed flow', { timeout: 120000 }, async t => {
  const h = await oauthHarness(); let release!: () => void; let entered!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  t.mock.method(console, 'warn', () => {});
  t.mock.method(h.fakeSha, 'begin', async () => { h.counters.begin++; entered(); await pending; throw new AppError('UPSTREAM_AUTH_FAILED', 401); });
  try {
    const flow = await start(h); const cookies = h.cookiesFor(flow.path);
    const attempt = h.post(`${flow.path}/login`, { csrf: flow.csrf, username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' });
    await started;
    const during = await h.request(flow.path); assert.equal(during.status, 400);
    assert.ok(!during.headers.getSetCookie().some(c => c.startsWith('profile_flow_')));
    const duplicate = await h.post(`${flow.path}/login`, { csrf: flow.csrf, username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' });
    assert.equal(duplicate.status, 400); assert.equal(h.cookiesFor(flow.path), cookies);
    release(); assert.equal((await attempt).status, 303);
    const html = await (await h.request(flow.path)).text(); assert.ok(html.includes('Thử đăng nhập lại'));
    assert.notEqual(h.csrf(html), flow.csrf); assert.equal(h.counters.begin, 1);
  } finally { release(); await h.close(); }
});

test('AUTH-FLOW-03: an in-flight legacy cookie migrates at login without relaxing browser binding', { timeout: 120000 }, async () => {
  const h = await oauthHarness();
  try {
    const flow = await start(h);
    const legacy = h.cookiesFor(flow.path).replace(/profile_flow_[a-f0-9]+=/, 'profile_flow=');
    const response = await h.request(`${flow.path}/login`, { method: 'POST', headers: { Origin: h.settings.origin, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: legacy }, body: new URLSearchParams({ csrf: flow.csrf, username: 'SYNTHETIC', password: 'FAKE_PASSWORD_CANARY' }) });
    assert.equal(response.status, 303);
    const saved = response.headers.getSetCookie().find(c => c.startsWith('profile_flow_'))!;
    assert.ok(saved); assert.match(saved, /HttpOnly/i); assert.match(saved, /SameSite=Lax/i); assert.match(saved, /Path=\//i);
    assert.equal(h.counters.begin, 1);
    assert.ok((await (await h.request(flow.path)).text()).includes('name="otp"'));
  } finally { await h.close(); }
});

test('AUTH-FLOW-04: rejected password redirects to a fresh empty form; retry completes the same OAuth interaction', { timeout: 120000 }, async t => {
  const h = await oauthHarness(); const logs: string[] = [];
  t.mock.method(console, 'warn', (line: string) => logs.push(line));
  const begin = h.fakeSha.begin.bind(h.fakeSha);
  t.mock.method(h.fakeSha, 'begin', async (username: string) => {
    if (!h.counters.begin) { h.counters.begin++; throw new AppError('UPSTREAM_AUTH_FAILED', 401); }
    return begin(username);
  });
  try {
    const first = await start(h); const originalCookies = h.cookiesFor(first.path);
    const failed = await h.post(`${first.path}/login`, { csrf: first.csrf, username: 'SYNTHETIC', password: 'BAD_PASSWORD_CANARY' });
    assert.equal(failed.status, 303); assert.equal(failed.headers.get('location'), first.path);
    const retry = await h.request(first.path); const html = await retry.text();
    assert.equal(retry.status, 200); assert.ok(html.includes('role="alert"')); assert.ok(html.includes('Kiểm tra ID và mật khẩu'));
    assert.ok(html.includes(failed.headers.get('x-request-id')!));
    assert.ok(!html.includes('BAD_PASSWORD_CANARY')); assert.ok(!html.includes('value="SYNTHETIC"'));
    const csrf = h.csrf(html); assert.notEqual(csrf, first.csrf);
    assert.notEqual(h.cookiesFor(first.path), originalCookies);
    const newHandle = h.cookiesFor(first.path).split('; ').find(c => c.startsWith('profile_flow_'))!.split('=')[1]!;
    const stored = (await h.store.get('ShaFlow', newHandle))!;
    assert.deepEqual(Object.keys(stored).sort(), ['clientId', 'csrf', 'notice', 'params', 'stage', 'uid']);
    assert.ok(!JSON.stringify(stored).includes('BAD_PASSWORD_CANARY'));
    assert.equal(h.counters.begin, 1);
    await h.request(first.path); assert.equal(h.counters.begin, 1); // refresh cannot replay a password
    const replay = await h.request(`${first.path}/login`, { method: 'POST', headers: { Origin: h.settings.origin, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: originalCookies }, body: new URLSearchParams({ csrf: first.csrf, username: 'SYNTHETIC', password: 'BAD_PASSWORD_CANARY' }) });
    assert.equal(replay.status, 400); assert.ok((await replay.text()).includes(`href="${first.path}"`));
    assert.equal(h.counters.begin, 1);
    assert.equal((await h.post(`${first.path}/login`, { csrf, username: ' SYNTHETIC ', password: 'FAKE_PASSWORD_CANARY' })).status, 303);
    const otpHtml = await (await h.request(first.path)).text(); assert.ok(!otpHtml.includes('role="alert"'));
    assert.equal((await h.post(`${first.path}/verify`, { csrf: h.csrf(otpHtml), otp: 'FAKE_OTP_CANARY' })).status, 303);
    const consentHtml = await (await h.request(first.path)).text(); assert.ok(consentHtml.includes('Cấp quyền đọc'));
    let finish = await h.post(`${first.path}/consent`, { csrf: h.csrf(consentHtml), decision: 'allow' });
    for (let n = 0; n < 5 && !finish.headers.get('location')?.startsWith('https://client.example/'); n++) finish = await h.request(finish.headers.get('location')!);
    const callback = new URL(finish.headers.get('location')!); assert.equal(callback.origin, 'https://client.example'); assert.ok(callback.searchParams.get('code'));
    assert.equal(h.counters.begin, 2); assert.equal(h.counters.verify, 1);
    for (const secret of ['BAD_PASSWORD_CANARY', 'FAKE_PASSWORD_CANARY', 'FAKE_OTP_CANARY', 'SYNTHETIC', first.csrf, originalCookies]) assert.ok(!logs.join('').includes(secret));
  } finally { await h.close(); }
});
