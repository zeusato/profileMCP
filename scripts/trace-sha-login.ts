// Opt-in G1 trace: the user types their own SHA ID/password/OTP into a 127.0.0.1 page; the production ShaAuth adapter runs from this machine.
// Prints only transport diagnostics (sha.upstream), response structure (key names, value kinds, counts). Never credentials, OTP, sessionKey, tokens or account values.
// --probe: after login, calls each read candidate once (read-only, sequential) for one sample account and the user's root broker to record live shapes.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { ShaAuth, type Challenge, type ShaLogin } from '../src/sha/auth.js';
import { ShaTransport } from '../src/sha/transport.js';
import { buildRequest } from '../src/sha/requests.js';
import { Policy, type Entitlements } from '../src/policy.js';
import { Vault } from '../src/crypto.js';
import { AppError } from '../src/errors.js';
import { page, escapeHtml, hidden, contentSecurityPolicy } from '../src/web.js';
if (!process.argv.includes('--live')) throw new Error('Opt-in required: --live (uses a real SHA account typed by its owner)');
const PROBE = process.argv.includes('--probe'); const EXTRA = process.argv.includes('--extra');
const key = (k: string) => /^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(k);
let typedUser = ''; let currentOperation = 'auth';
// Error envelopes only: SHA message with the typed ID and any 4+ digit run masked, control characters stripped, capped.
const safeMessage = (m: unknown) => typeof m !== 'string' ? null : m.replace(typedUser ? new RegExp(typedUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') : /$^/, '[id]').replace(/\d{4,}/g, '[n]').replace(/[\u0000-\u001f]/g, ' ').slice(0, 160);
// Structure only: letter-initial keys with value kinds; arrays as item count + first item's shape; string kinds are format hints, never values.
function shape(v: unknown, depth = 0): unknown {
  if (v === null) return 'null';
  if (Array.isArray(v)) return { items: v.length, of: v.length ? shape(v[0], depth + 1) : null };
  if (typeof v === 'object') return depth >= 4 ? 'object' : Object.fromEntries(Object.entries(v as object).filter(([k]) => key(k)).slice(0, 80).map(([k, x]) => [k, shape(x, depth + 1)]));
  if (typeof v === 'number') return Number.isInteger(v) ? 'number:int' : 'number:decimal';
  if (typeof v !== 'string') return typeof v;
  if (v === '') return 'string:empty';
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(v)) return 'string:datetime';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'string:yyyy-mm-dd';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(v)) return 'string:dd/mm/yyyy';
  if (/^(19|20)\d{6}$/.test(v)) return 'string:yyyymmdd?';
  if (/^-?\d+$/.test(v)) return 'string:int';
  if (/^-?\d+\.\d+$/.test(v)) return 'string:decimal-dot';
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(v)) return 'string:vi-number';
  return 'string';
}
const shapeFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init); const step = new URL(String(input)).pathname.split('/').pop();
  if (/json/i.test(response.headers.get('content-type') ?? '')) {
    try {
      const raw = await response.clone().json() as any; const enveloped = raw && typeof raw === 'object' && !Array.isArray(raw) && 'code' in raw;
      // Validation errors list offending parameter names (e.g. list-confirm "Invalid parameter"): names only, never their values.
      const fieldNames = enveloped && Array.isArray(raw.data) ? raw.data.map((x: any) => x?.fieldName).filter((n: unknown) => typeof n === 'string' && key(n)).slice(0, 10) : undefined;
      if (enveloped && String(raw.code) !== '200') console.log(JSON.stringify({ event: 'trace.error_message', operation: currentOperation, step, code: String(raw.code).slice(0, 8), message: safeMessage(raw.message), fieldNames }));
      console.log(JSON.stringify({ event: 'trace.shape', operation: currentOperation, method: init?.method ?? 'GET', step, httpStatus: response.status, envelope: enveloped ? Object.keys(raw).filter(key) : null, data: shape(enveloped ? raw.data : raw) }));
    } catch { console.log(JSON.stringify({ event: 'trace.shape', operation: currentOperation, step, httpStatus: response.status, parse: 'failed' })); }
  } else console.log(JSON.stringify({ event: 'trace.shape', operation: currentOperation, step, httpStatus: response.status, contentType: (response.headers.get('content-type') ?? 'none').split(';')[0] }));
  return response;
};
const transport = new ShaTransport(shapeFetch);
const auth = new ShaAuth(transport, true);
async function probe(login: ShaLogin) {
  const vault = new Vault({ active: 'p', keys: { p: randomBytes(32).toString('base64url') } }, randomBytes(32).toString('base64url'));
  const entitlements = login.entitlements as Entitlements;
  const p = new Policy({ id: 'probe', userId: 'probe', teamId: 'probe', generation: 1, clientId: 'probe', grantId: 'probe', expiresAt: login.expiresAt, scopes: [], bearer: login.bearer, identity: login.identity, entitlements, resource: 'probe' }, vault, entitlements);
  const root = p.broker(); const brokerRef = p.ref('broker', root.brokerCode);
  const sample = entitlements.accounts.find(a => a.brokerCode === root.brokerCode) ?? entitlements.accounts[0]!; const accountRef = p.ref('acct', sample.accountNumber);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const minus = (days: number) => new Date(Date.parse(today) - days * 86400000).toISOString().slice(0, 10);
  const period = { from: minus(29), to: today }; const results: Record<string, string> = {};
  // checkedRead skips the release list on purpose: this opt-in local probe records shapes of unreleased candidates; runtime always goes through read().
  const run = async (id: string, input: Record<string, unknown>) => {
    currentOperation = id; await sleep(300);
    try { const data = await (transport as any).checkedRead(buildRequest(id, { operation: id, ...input }, p), login.bearer); results[id] = 'ok'; return data; }
    catch (error) { results[id] = error instanceof AppError ? error.code : 'UNEXPECTED'; console.log(JSON.stringify({ event: 'probe.result', operation: id, outcome: results[id] })); return undefined; }
  };
  const subs = await run('accounts.subaccounts', { accountRefs: [accountRef] });
  if (Array.isArray(subs)) entitlements.subaccounts = subs.flatMap((r: any) => Array.isArray(r?.subAccounts) ? r.subAccounts.filter((s: any) => typeof s?.subId === 'string' && typeof s?.subNo === 'string').map((s: any) => ({ accountNo: r.accountNo, subId: s.subId, subNo: s.subNo })) : []);
  const sub = entitlements.subaccounts.find(s => s.accountNo === sample.accountNumber); const subaccountRef = sub && p.ref('sub', sub.subId);
  const plan: [string, Record<string, unknown>][] = [
    ['accounts.search', { brokerRef, limit: 5 }], ['profile.detail', { accountRef }], ['profile.information', { accountRef }], ['profile.authorized', { accountRef }],
    ['customers.overview', { brokerRef, ...period }],
    ...(subaccountRef ? ['assets.cash', 'assets.stockValue', 'assets.margin', 'assets.loanSummary', 'assets.loanDetail', 'portfolio.account', 'orderSummary.account'].map(id => [id, { accountRef, subaccountRef }] as [string, Record<string, unknown>]) : []),
    ['brokerAssets.summary', { brokerRef }], ['brokerAssets.accounts', { brokerRef, limit: 5 }], ['brokerAssets.cash', { brokerRef, limit: 5 }], ['brokerAssets.portfolio', { brokerRef, limit: 5 }],
    ['credit.guarantees', { brokerRef, limit: 5 }], ['credit.collateral', { brokerRef, limit: 5 }],
    ['loans.current', { brokerRef, limit: 5 }], ['loans.history', { brokerRef, ...period, limit: 5 }], ['loans.repayments', { brokerRef, repayFrom: period.from, repayTo: period.to, limit: 5 }],
    ['orders.history', { brokerRef, mode: 'history', ...period, limit: 5 }], ['orders.history', { brokerRef, mode: 'today', limit: 5 }], ['orders.unconfirmed', { ...period, limit: 5 }],
    ['orderSummary.confirmations', {}], ['orderSummary.top', { brokerRef }], ['orderSummary.transactions', { brokerRef, limit: 5 }],
    ['cash.movements', { brokerRef, ...period, limit: 5 }], ['newAccounts.report', { brokerRef, ...period, limit: 5 }],
    ['research.summary', { brokerRef }], ['research.list', { brokerRef }], ['groups.list', { brokerRef }],
    ['market.catalog', {}], ['market.quote', { symbol: 'FPT' }], ['market.price', { symbol: 'FPT' }], ['market.ticks', { symbol: 'FPT', limit: 5 }],
    ['market.candles', { symbol: 'FPT', resolution: '1D', fromTime: new Date(Date.now() - 90 * 86400000).toISOString(), toTime: new Date().toISOString() }],
  ];
  if (!subaccountRef) results['assets.*'] = 'SKIPPED_NO_SUBACCOUNT';
  if (!EXTRA) { for (const [id, input] of plan) await run(id, input); results['buyingPower.preview'] = 'SKIPPED_SIDE_EFFECT_UNVERIFIED'; }
  else {
    // --extra (10/10/2026): operations still disabled after the first probe, plus the KMS knowledge library.
    await run('orders.unconfirmed', { ...period, limit: 5 }); results['orders.unconfirmed:29d/5'] = results['orders.unconfirmed']!;
    await run('orders.unconfirmed', { from: minus(6), to: today, limit: 30 }); results['orders.unconfirmed:7d/30'] = results['orders.unconfirmed']!;
    // order/balance computes buying power for a symbol/price (SHA_PC docs 6.3); it creates no order.
    if (subaccountRef) await run('buyingPower.preview', { accountRef, subaccountRef, symbol: 'FPT', price: '57900' });
    await run('orderSummary.top', { brokerRef }); await run('orderSummary.transactions', { brokerRef, limit: 5 });
    for (const a of entitlements.accounts) { await run('profile.authorized', { accountRef: p.ref('acct', a.accountNumber) }); results[`profile.authorized:${entitlements.accounts.indexOf(a)}`] = results['profile.authorized']!; }
    const departments = await run('knowledge.departments', {}) as any; const codes = (Array.isArray(departments?.data) ? departments.data : []).map((d: any) => d?.Code).filter((c: unknown) => typeof c === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(c));
    console.log(JSON.stringify({ event: 'probe.departments', count: codes.length }));
    for (const code of codes.slice(0, 2)) await run('knowledge.documents', { department: code, limit: 5 });
  }
  console.log(JSON.stringify({ event: 'probe.summary', results }));
}
const token = randomBytes(16).toString('base64url'); let attempts = 0; let challenge: Challenge | undefined; let origin = '';
const done = (code: number) => { console.log(JSON.stringify({ event: 'trace.end' })); setTimeout(() => process.exit(code), 500); };
setTimeout(() => { console.log(JSON.stringify({ event: 'trace.timeout' })); process.exit(2); }, 15 * 60000).unref();
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('Content-Security-Policy', contentSecurityPolicy());
  const send = (status: number, title: string, body: string) => { res.statusCode = status; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(page(title, body)); };
  if (req.headers.host !== new URL(origin).host || !req.url?.startsWith(`/${token}`)) { res.statusCode = 404; res.end(); return; }
  if (req.method === 'GET' && req.url === `/${token}`) {
    send(200, 'Trace đăng nhập SHA (local)', `<p>Chạy từ máy này tới api.shs.com.vn bằng adapter production. Terminal chỉ in status/tên field.${PROBE ? ' Sau OTP sẽ probe chỉ-đọc các API tra cứu.' : ''}</p><section><form method="post" action="/${token}/login">${hidden('t', token)}<label for="u">ID đăng nhập SHA</label><input id="u" name="username" autocomplete="username" required maxlength="100"><label for="p">Mật khẩu</label><input id="p" name="password" type="password" autocomplete="current-password" required maxlength="256"><button>Gửi login-v2</button></form></section>`); return;
  }
  if (req.method !== 'POST' || req.headers.origin !== origin) { res.statusCode = 403; res.end(); return; }
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 4096) { res.statusCode = 413; res.end(); return; } }
  const form = new URLSearchParams(raw); if (form.get('t') !== token) { res.statusCode = 403; res.end(); return; }
  try {
    if (req.url === `/${token}/login` && !challenge && attempts < 2) {
      attempts++; const username = form.get('username') ?? ''; const password = form.get('password') ?? '';
      if (!/^[A-Za-z0-9_.-]{1,100}$/.test(username) || !password) throw new AppError('INVALID_INPUT');
      typedUser = username;
      challenge = await auth.begin(username, password);
      console.log(JSON.stringify({ event: 'trace.result', stage: 'login', outcome: 'challenge_ready', otpIndexType: Array.isArray(challenge.otpIndex) ? 'array' : typeof challenge.otpIndex, ttlSeconds: Math.round((challenge.expiresAt - Date.now()) / 1000) }));
      send(200, 'Nhập OTP', `<section><p>Vị trí xác thực</p><div class="challenge">${escapeHtml(Array.isArray(challenge.otpIndex) ? challenge.otpIndex.join(' · ') : challenge.otpIndex)}</div><form method="post" action="/${token}/verify">${hidden('t', token)}<label for="o">Mã OTP</label><input id="o" name="otp" type="password" autocomplete="one-time-code" required maxlength="32"><button>Gửi verify-sotp</button></form></section>`);
    } else if (req.url === `/${token}/verify` && challenge) {
      const current = challenge; challenge = undefined; const login = await auth.verify(current, form.get('otp') ?? '');
      console.log(JSON.stringify({ event: 'trace.result', stage: 'verify', outcome: 'session_ready', ttlMinutes: Math.round((login.expiresAt - Date.now()) / 60000), identityRows: login.identity.rows.length, brokerCodes: login.identity.brokerCodes.length, accounts: login.entitlements.accounts.length, brokers: login.entitlements.brokers.length }));
      send(200, 'Trace xong', `<p>Login SHA, OTP và bootstrap identity/tree thành công.${PROBE ? ' Probe chỉ-đọc đang chạy, xem terminal; khoảng 1 phút.' : ''} Token chỉ giữ trong bộ nhớ, không lưu. Có thể đóng trang.</p>`);
      if (PROBE) await probe(login);
      done(0);
    } else { send(409, 'Không hợp lệ', '<p>Bước không hợp lệ hoặc đã hết lượt thử. Chạy lại script nếu cần.</p>'); }
  } catch (error) {
    const code = error instanceof AppError ? error.code : 'UNEXPECTED';
    console.log(JSON.stringify({ event: 'trace.result', stage: req.url?.endsWith('/verify') ? 'verify' : 'login', outcome: code }));
    if (!res.headersSent) send(400, 'Trace dừng', `<p>${escapeHtml(code)}</p><p>Xem terminal để biết bước SHA và HTTP status. Không tự thử lại.</p>`);
    if (req.url?.endsWith('/verify') || attempts >= 2) done(1);
  }
});
server.listen(0, '127.0.0.1', () => {
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  console.log(JSON.stringify({ event: 'trace.ready', url: `${origin}/${token}`, probe: PROBE }));
});
