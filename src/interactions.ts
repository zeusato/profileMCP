import type { Express, Request, Response } from 'express';
import express from 'express';
import type Provider from 'oidc-provider';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Settings } from './config.js';
import { SCOPES } from './config.js';
import { Store, type Json } from './store.js';
import type { AuthGateway } from './sha/auth.js';
import { AppError, ensure } from './errors.js';
import { page, escapeHtml as e, hidden } from './web.js';
function cookie(req: Request, name: string) { return req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1); }
export function interactions(app: Express, provider: Provider, settings: Settings, store: Store, sha: AuthGateway) {
  const secure = settings.environment !== 'local';
  const name = secure ? '__Host-profile_flow' : 'profile_flow'; const management = secure ? '__Host-profile_manage' : 'profile_manage';
  const options = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: 600000 };
  const form = express.urlencoded({ extended: false, limit: '8kb', parameterLimit: 12 });
  const checkOrigin = (req: Request) => ensure(req.headers.origin === settings.origin, 'FORBIDDEN_SCOPE');
  async function load(req: Request, uid: string) {
    const handle = cookie(req, name); ensure(handle && /^[A-Za-z0-9_-]{43}$/.test(handle), 'REAUTH_REQUIRED');
    const flow = await store.get('ShaFlow', handle); ensure(flow && !flow.consumed && flow.uid === uid, 'REAUTH_REQUIRED');
    return { flow, handle };
  }
  async function save(res: Response, flow: Json, old?: string) {
    const handle = store.vault.nonce(); await store.put('ShaFlow', handle, flow, 600);
    if (old) await store.destroy('ShaFlow', old); res.cookie(name, handle, options); return handle;
  }
  const fields = (f: Json) => hidden('csrf', f.csrf);
  app.get('/interaction/:uid', async (req, res) => {
    const detail = await provider.interactionDetails(req, res); const uid = String(req.params.uid); ensure(detail.uid === uid, 'REAUTH_REQUIRED');
    let flow: Json;
    try { flow = (await load(req, uid)).flow; } catch (error) {
      if (!(error instanceof AppError && error.code === 'REAUTH_REQUIRED')) throw error;
      flow = { uid, stage: 'login', csrf: store.vault.nonce(), clientId: String(detail.params.client_id), params: detail.params };
      await save(res, flow);
    }
    const client = await provider.Client.find(String(detail.params.client_id)); ensure(client, 'UNAUTHENTICATED');
    const clientName = e(client.clientName || client.clientId);
    const action = `/interaction/${encodeURIComponent(uid)}`;
    if (flow.stage === 'login') res.type('html').send(page('Kết nối tài khoản SHA', `<p>Đăng nhập tài khoản của bạn để cấp quyền đọc cho <strong>${clientName}</strong>.</p><section><form method="post" action="${action}/login">${fields(flow)}<label for="username">ID đăng nhập SHA</label><input id="username" name="username" autocomplete="username" required maxlength="100"><label for="password">Mật khẩu</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button>Tiếp tục</button></form></section>`));
    else if (flow.stage === 'otp') res.type('html').send(page('Xác thực tài khoản', `<p>Nhập OTP theo yêu cầu từ SHA. Phiên xác thực hết hạn theo thời gian SHA cung cấp.</p><section><p>Vị trí xác thực</p><div class="challenge">${e(Array.isArray(flow.challenge.otpIndex) ? flow.challenge.otpIndex.join(' · ') : flow.challenge.otpIndex)}</div><form method="post" action="${action}/verify">${fields(flow)}<label for="otp">Mã OTP</label><input id="otp" name="otp" type="password" autocomplete="one-time-code" required maxlength="32"><button>Xác thực</button></form></section>`));
    else if (flow.stage === 'consent') {
      const scopes = String(detail.params.scope ?? '').split(' ').filter(s => SCOPES.includes(s)); ensure(scopes.length, 'FORBIDDEN_SCOPE');
      res.type('html').send(page('Cấp quyền đọc', `<p><strong>${clientName}</strong> yêu cầu đọc dữ liệu trong quyền của tài khoản SHA vừa xác thực.</p><section><p>Chuyển về: <strong>${e(new URL(String(detail.params.redirect_uri)).hostname)}</strong></p><p>Tài khoản: ${e(flow.login.identity.preferredUsername)}</p><ul>${scopes.map(s => `<li>${e(s)}</li>`).join('')}</ul><p>Ứng dụng không cung cấp thao tác đặt lệnh, chuyển tiền hoặc sửa hồ sơ.</p><form method="post" action="${action}/consent">${fields(flow)}<button name="decision" value="allow">Cho phép kết nối</button><button class="secondary" name="decision" value="deny">Từ chối</button></form></section>`));
    } else throw new AppError('REAUTH_REQUIRED');
  });
  app.post('/interaction/:uid/:step', form, async (req, res) => {
    checkOrigin(req); const detail = await provider.interactionDetails(req, res); const uid = String(req.params.uid); ensure(detail.uid === uid, 'REAUTH_REQUIRED');
    const { flow, handle } = await load(req, uid); ensure(typeof req.body.csrf === 'string' && store.vault.equal(flow.csrf, req.body.csrf), 'FORBIDDEN_SCOPE');
    ensure(flow.clientId === detail.params.client_id && JSON.stringify(flow.params) === JSON.stringify(detail.params), 'FORBIDDEN_SCOPE');
    ensure(await store.consume('ShaFlow', handle), 'REAUTH_REQUIRED');
    try {
      await store.quota(`login:${uid}`, 8, 600);
      if (req.params.step === 'login' && flow.stage === 'login') {
        const input = z.object({ csrf: z.string(), username: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/), password: z.string().min(1).max(256) }).strict().parse(req.body);
        const userId = await store.member(input.username); await store.quota(`login-user:${userId}`, 5, 600);
        const challenge = await sha.begin(input.username, input.password);
        await save(res, { ...flow, csrf: store.vault.nonce(), stage: 'otp', challenge, userId }, handle);
        res.redirect(303, `/interaction/${encodeURIComponent(uid)}`);
      } else if (req.params.step === 'verify' && flow.stage === 'otp') {
        const input = z.object({ csrf: z.string(), otp: z.string().min(1).max(32) }).strict().parse(req.body);
        ensure(flow.challenge.expiresAt > Date.now(), 'REAUTH_REQUIRED');
        const login = await sha.verify(flow.challenge, input.otp); const userId = await store.member(login.identity.preferredUsername);
        ensure(userId === flow.userId, 'FORBIDDEN_SCOPE');
        await save(res, { uid, params: flow.params, clientId: flow.clientId, stage: 'consent', csrf: store.vault.nonce(), login, userId }, handle);
        res.redirect(303, `/interaction/${encodeURIComponent(uid)}`);
      } else if (req.params.step === 'consent' && flow.stage === 'consent') {
        const input = z.object({ csrf: z.string(), decision: z.enum(['allow', 'deny']) }).strict().parse(req.body);
        await store.destroy('ShaFlow', handle); res.clearCookie(name, options);
        if (input.decision === 'deny') { await provider.interactionFinished(req, res, { error: 'access_denied' }, { mergeWithLastSubmission: false }); return; }
        const scopes = String(detail.params.scope ?? '').split(' ').filter(s => SCOPES.includes(s)); ensure(scopes.length, 'FORBIDDEN_SCOPE');
        ensure(flow.login.expiresAt > Date.now(), 'REAUTH_REQUIRED');
        const sessionId = randomUUID(); const grant = new provider.Grant({ accountId: flow.userId, clientId: flow.clientId });
        grant.addResourceScope(settings.resource, scopes.join(' ')); const grantId = await grant.save();
        try {
          const session = await store.createSession({ ...flow.login, userId: flow.userId, clientId: flow.clientId, grantId, scopes, resource: settings.resource }, sessionId);
          const manageHandle = store.vault.nonce(); await store.put('Management', manageHandle, { sessionId: session.id, csrf: store.vault.nonce() }, Math.min(28800, Math.floor((session.expiresAt - Date.now()) / 1000)));
          res.cookie(management, manageHandle, { ...options, maxAge: Math.min(28800000, session.expiresAt - Date.now()) });
          await provider.interactionFinished(req, res, { login: { accountId: flow.userId }, consent: { grantId } }, { mergeWithLastSubmission: false });
        } catch (error) { await store.revokeGrant(grantId); throw error; }
      } else throw new AppError('INVALID_INPUT');
    } catch (error) { await store.destroy('ShaFlow', handle); throw error; }
    finally { if (req.body) { delete req.body.password; delete req.body.otp; } }
  });
  app.get('/connections', async (req, res) => {
    const h = cookie(req, management); const m = h && await store.get('Management', h); ensure(m, 'REAUTH_REQUIRED'); const s = await store.session(m.sessionId);
    res.type('html').send(page('Kết nối đang hoạt động', `<section><p>Client: ${e(s.clientId)}</p><p>Quyền: ${s.scopes.map(e).join(', ')}</p><form method="post" action="/connections/disconnect">${hidden('csrf', m.csrf)}<button>Ngắt kết nối</button></form></section>`));
  });
  app.post('/connections/disconnect', form, async (req, res) => {
    checkOrigin(req); const h = cookie(req, management); const m = h && await store.get('Management', h); ensure(m && typeof req.body.csrf === 'string' && store.vault.equal(m.csrf, req.body.csrf), 'FORBIDDEN_SCOPE');
    await store.revoke(await store.session(m.sessionId)); await store.destroy('Management', h!); res.clearCookie(management, options);
    res.type('html').send(page('Đã ngắt kết nối', '<p>Quyền truy cập của kết nối này đã được thu hồi. Kết nối lại từ client để đăng nhập mới.</p>'));
  });
}
