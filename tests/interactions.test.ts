import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { oauthHarness } from './helpers.js';

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
    const html = await missing.text(); assert.ok(html.includes('Chưa chuyển được tới bước OTP'));
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
