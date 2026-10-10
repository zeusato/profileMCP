// Opt-in G1 trace: the user types their own SHA ID/password/OTP into a 127.0.0.1 page; the production ShaAuth adapter runs from this machine.
// Prints only transport diagnostics (sha.upstream), response key names and counts. Never credentials, OTP, sessionKey, tokens, messages or account values.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { ShaAuth, type Challenge } from '../src/sha/auth.js';
import { ShaTransport } from '../src/sha/transport.js';
import { AppError } from '../src/errors.js';
import { page, escapeHtml, hidden, contentSecurityPolicy } from '../src/web.js';
if (!process.argv.includes('--live')) throw new Error('Opt-in required: --live (uses a real SHA account typed by its owner)');
const key = (k: string) => /^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(k);
let typedUser = '';
// Error envelopes only: SHA message with the typed ID and any 4+ digit run masked, control characters stripped, capped.
const safeMessage = (m: unknown) => typeof m !== 'string' ? null : m.replace(typedUser ? new RegExp(typedUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') : /$^/, '[id]').replace(/\d{4,}/g, '[n]').replace(/[\u0000-\u001f]/g, ' ').slice(0, 160);
// Key names one level into `data` (object, or first array item); identifiers that start with digits are dropped.
const shapeFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init); const step = new URL(String(input)).pathname.split('/').pop();
  if (/json/i.test(response.headers.get('content-type') ?? '')) {
    try {
      const raw = await response.clone().json() as any; const data = raw?.data; const sample = Array.isArray(data) ? data[0] : data;
      if (String(raw?.code) !== '200') console.log(JSON.stringify({ event: 'trace.error_message', step, code: String(raw?.code).slice(0, 8), message: safeMessage(raw?.message) }));
      console.log(JSON.stringify({ event: 'trace.shape', step, dataType: Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data, items: Array.isArray(data) ? data.length : null,
        dataKeys: sample && typeof sample === 'object' ? Object.keys(sample).filter(key).slice(0, 30) : [],
        dataTypes: sample && typeof sample === 'object' ? Object.fromEntries(Object.entries(sample).filter(([k]) => key(k)).slice(0, 30).map(([k, v]) => [k, v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v])) : {},
        // Second level: for array fields, item count and the first item's key names (still no values).
        nested: sample && typeof sample === 'object' ? Object.fromEntries(Object.entries(sample).filter(([k, v]) => key(k) && Array.isArray(v)).slice(0, 10).map(([k, v]) => [k, { items: (v as unknown[]).length, keys: (v as any[])[0] && typeof (v as any[])[0] === 'object' ? Object.keys((v as any[])[0]).filter(key).slice(0, 30) : typeof (v as any[])[0] }])) : {} }));
    } catch { console.log(JSON.stringify({ event: 'trace.shape', step, parse: 'failed' })); }
  }
  return response;
};
const auth = new ShaAuth(new ShaTransport(shapeFetch), true);
const token = randomBytes(16).toString('base64url'); let attempts = 0; let challenge: Challenge | undefined; let origin = '';
const done = (code: number) => { console.log(JSON.stringify({ event: 'trace.end' })); setTimeout(() => process.exit(code), 500); };
setTimeout(() => { console.log(JSON.stringify({ event: 'trace.timeout' })); process.exit(2); }, 15 * 60000).unref();
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('Content-Security-Policy', contentSecurityPolicy());
  const send = (status: number, title: string, body: string) => { res.statusCode = status; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(page(title, body)); };
  if (req.headers.host !== new URL(origin).host || !req.url?.startsWith(`/${token}`)) { res.statusCode = 404; res.end(); return; }
  if (req.method === 'GET' && req.url === `/${token}`) {
    send(200, 'Trace đăng nhập SHA (local)', `<p>Chạy từ máy này tới api.shs.com.vn bằng adapter production. Terminal chỉ in status/tên field.</p><section><form method="post" action="/${token}/login">${hidden('t', token)}<label for="u">ID đăng nhập SHA</label><input id="u" name="username" autocomplete="username" required maxlength="100"><label for="p">Mật khẩu</label><input id="p" name="password" type="password" autocomplete="current-password" required maxlength="256"><button>Gửi login-v2</button></form></section>`); return;
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
      send(200, 'Trace xong', '<p>Login SHA, OTP và bootstrap identity/tree thành công. Token đã bỏ, không lưu. Có thể đóng trang.</p>'); done(0);
    } else { send(409, 'Không hợp lệ', '<p>Bước không hợp lệ hoặc đã hết lượt thử. Chạy lại script nếu cần.</p>'); }
  } catch (error) {
    const code = error instanceof AppError ? error.code : 'UNEXPECTED';
    console.log(JSON.stringify({ event: 'trace.result', stage: req.url?.endsWith('/verify') ? 'verify' : 'login', outcome: code }));
    send(400, 'Trace dừng', `<p>${escapeHtml(code)}</p><p>Xem terminal để biết bước SHA và HTTP status. Không tự thử lại.</p>`);
    if (req.url?.endsWith('/verify') || attempts >= 2) done(1);
  }
});
server.listen(0, '127.0.0.1', () => {
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  console.log(JSON.stringify({ event: 'trace.ready', url: `${origin}/${token}` }));
});
