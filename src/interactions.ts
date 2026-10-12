import type { Express, Request, Response } from 'express';
import express from 'express';
import type Provider from 'oidc-provider';
import { errors as oauthErrors } from 'oidc-provider';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import type { Settings } from './config.js';
import { SCOPES, PII_SCOPE } from './config.js';
import { Store, type Json } from './store.js';
import type { AuthGateway } from './sha/auth.js';
import { AppError, ensure, InteractionError, requireInteraction, publicError, reportInteractionFailure } from './errors.js';
import { page, escapeHtml as e, hidden, contentSecurityPolicy, interactionGuidance } from './web.js';
function cookie(req: Request, name: string) { return req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1); }
export function interactions(app: Express, provider: Provider, settings: Settings, store: Store, sha: AuthGateway) {
  const secure = settings.environment !== 'local';
  const name = secure ? '__Host-profile_flow' : 'profile_flow'; const management = secure ? '__Host-profile_manage' : 'profile_manage';
  // Each provider interaction already has its own cookie path. Give the SHA flow
  // the same isolation while preserving __Host- (Secure, Path=/, no Domain).
  const flowName = (uid: string) => `${name}_${store.vault.digest(`flow-cookie:${uid}`)}`;
  const options = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: 600000 };
  const form = express.urlencoded({ extended: false, limit: '8kb', parameterLimit: 12 });
  const checkOrigin = (req: Request) => ensure(req.headers.origin === settings.origin, 'FORBIDDEN_SCOPE');
  async function details(req: Request, res: Response) {
    try {
      const detail = await provider.interactionDetails(req, res);
      requireInteraction(detail.uid === String(req.params.uid), 'interaction_mismatch');
      // Recovery URLs come only from a live provider-validated interaction, never form/query input.
      res.locals.interactionPath = `/interaction/${encodeURIComponent(detail.uid)}`;
      return detail;
    } catch (error) {
      if (error instanceof oauthErrors.SessionNotFound) throw new InteractionError('provider_session_missing');
      throw error;
    }
  }
  async function load(req: Request, uid: string) {
    // Accept an in-flight pre-upgrade cookie only with the same UID binding below.
    const handle = cookie(req, flowName(uid)) ?? cookie(req, name);
    requireInteraction(handle, 'flow_cookie_missing');
    requireInteraction(/^[A-Za-z0-9_-]{43}$/.test(handle), 'flow_cookie_invalid');
    const flow = await store.get('ShaFlow', handle);
    requireInteraction(flow, 'flow_expired');
    requireInteraction(flow.uid === uid, 'flow_mismatch');
    requireInteraction(!flow.consumed, 'flow_consumed');
    return { flow, handle };
  }
  async function save(res: Response, flow: Json, old?: string) {
    const handle = store.vault.nonce(); await store.put('ShaFlow', handle, flow, 600);
    if (old) await store.destroy('ShaFlow', old); res.cookie(flowName(flow.uid), handle, options); return handle;
  }
  const fields = (f: Json) => hidden('csrf', f.csrf);
  const base = (f: Json) => ({ uid: f.uid, clientId: f.clientId, params: f.params, csrf: store.vault.nonce() });
  async function member(username: string) {
    try { return await store.member(username); }
    catch (error) { if (error instanceof AppError && error.code === 'FORBIDDEN_SCOPE') throw new InteractionError('member_not_allowed', 'FORBIDDEN_SCOPE'); throw error; }
  }
  app.get('/interaction/:uid', async (req, res) => {
    const detail = await details(req, res); const uid = String(req.params.uid);
    // Only the read scopes can be consented; anything else (e.g. openid) would re-prompt forever, so return invalid_scope before any SHA login.
    const requested = String(detail.params.scope ?? '').split(' ').filter(Boolean);
    if (!requested.length || requested.some(s => !SCOPES.includes(s))) { await provider.interactionFinished(req, res, { error: 'invalid_scope', error_description: 'Requested scope is not supported' }, { mergeWithLastSubmission: false }); return; }
    let flow: Json;
    try { flow = (await load(req, uid)).flow; } catch (error) {
      if (!(error instanceof AppError && error.code === 'REAUTH_REQUIRED')) throw error;
      if (error instanceof InteractionError && error.reason === 'flow_consumed') throw error;
      flow = { uid, stage: 'login', csrf: store.vault.nonce(), clientId: String(detail.params.client_id), params: detail.params };
      await save(res, flow);
    }
    const client = await provider.Client.find(String(detail.params.client_id)); ensure(client, 'UNAUTHENTICATED');
    const clientName = e(client.clientName || client.clientId);
    const action = `/interaction/${encodeURIComponent(uid)}`;
    const notice = flow.notice ? `<section role="alert"><p>${e(interactionGuidance(flow.notice.error, flow.notice.step, flow.notice.reason))}</p><small>Mã hỗ trợ: ${e(flow.notice.requestId)} · ${e(flow.notice.error)}</small></section>` : '';
    if (flow.stage === 'login') res.type('html').send(page('Kết nối tài khoản SHA', `<p>Bước 1/3 · Đăng nhập SHA</p><p>Đăng nhập tài khoản của bạn để cấp quyền đọc cho <strong>${clientName}</strong>.</p>${notice}<section><form method="post" action="${action}/login">${fields(flow)}<label for="username">ID đăng nhập SHA</label><input id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="100"><label for="password">Mật khẩu</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button>${flow.notice ? 'Thử đăng nhập lại' : 'Tiếp tục'}</button></form></section>`));
    else if (flow.stage === 'otp') res.type('html').send(page('Xác thực tài khoản', `<p>Bước 2/3 · Xác thực OTP</p><p>Nhập OTP theo yêu cầu từ SHA. Phiên xác thực hết hạn theo thời gian SHA cung cấp.</p><section><p>Vị trí xác thực</p><div class="challenge">${e(Array.isArray(flow.challenge.otpIndex) ? flow.challenge.otpIndex.join(' · ') : flow.challenge.otpIndex)}</div><form method="post" action="${action}/verify">${fields(flow)}<label for="otp">Mã OTP</label><input id="otp" name="otp" type="password" autocomplete="one-time-code" required maxlength="32"><button>Xác thực</button></form><form method="post" action="${action}/restart">${fields(flow)}<button class="secondary">Đăng nhập lại / Đổi ID</button></form></section>`));
    else if (flow.stage === 'consent') {
      const scopes = String(detail.params.scope ?? '').split(' ').filter(s => SCOPES.includes(s)); const read = scopes.filter(s => s !== PII_SCOPE); ensure(read.length, 'FORBIDDEN_SCOPE');
      // profile.pii is opt-in: an unchecked box by default, only when the client asked for it.
      const pii = scopes.includes(PII_SCOPE) ? `<label class="check"><input type="checkbox" name="pii" value="1"><span>Cho phép xem <strong>số tài khoản đầy đủ và tên khách hàng</strong> (${e(PII_SCOPE)}). Không chọn thì chỉ thấy mã tham chiếu và số tài khoản che.</span></label>` : '';
      // Allow/deny both end in a redirect to the provider-validated redirect_uri.
      res.set('Content-Security-Policy', contentSecurityPolicy([String(detail.params.redirect_uri)]));
      res.type('html').send(page('Cấp quyền đọc', `<p>Bước 3/3 · Cấp quyền đọc</p><p><strong>${clientName}</strong> yêu cầu đọc dữ liệu trong quyền của tài khoản SHA vừa xác thực.</p><section><p>Chuyển về: <strong>${e(new URL(String(detail.params.redirect_uri)).hostname)}</strong></p><p>Tài khoản: ${e(flow.login.identity.preferredUsername)}</p><ul>${read.map(s => `<li>${e(s)}</li>`).join('')}</ul><p>Ứng dụng không cung cấp thao tác đặt lệnh, chuyển tiền hoặc sửa hồ sơ.</p><form method="post" action="${action}/consent">${fields(flow)}${pii}<button name="decision" value="allow">Cho phép kết nối</button><button class="secondary" name="decision" value="deny">Từ chối</button></form></section>`));
    } else throw new AppError('REAUTH_REQUIRED');
  });
  app.post('/interaction/:uid/:step', form, async (req, res) => {
    try {
      checkOrigin(req); const detail = await details(req, res); const uid = String(req.params.uid);
      const { flow, handle } = await load(req, uid);
      if (typeof req.body.csrf !== 'string' || !store.vault.equal(flow.csrf, req.body.csrf)) throw new InteractionError('csrf_mismatch', 'FORBIDDEN_SCOPE');
      if (flow.clientId !== detail.params.client_id || JSON.stringify(flow.params) !== JSON.stringify(detail.params)) throw new InteractionError('authorization_mismatch', 'FORBIDDEN_SCOPE');
      requireInteraction(await store.consume('ShaFlow', handle), 'flow_consumed');
      try {
        await store.quota(`login:${uid}`, 8, 600);
        if (req.params.step === 'restart' && flow.stage === 'otp') {
          z.object({ csrf: z.string() }).strict().parse(req.body);
          await save(res, { ...base(flow), stage: 'login' }, handle);
          res.redirect(303, `/interaction/${encodeURIComponent(uid)}`);
        } else if (req.params.step === 'login' && flow.stage === 'login') {
          const input = z.object({ csrf: z.string(), username: z.string().trim().regex(/^[A-Za-z0-9_.-]{1,100}$/), password: z.string().min(1).max(256) }).strict().parse(req.body);
          const userId = await member(input.username); await store.quota(`login-user:${userId}`, 5, 600);
          const challenge = await sha.begin(input.username, input.password);
          await save(res, { ...base(flow), stage: 'otp', challenge, userId }, handle);
          res.redirect(303, `/interaction/${encodeURIComponent(uid)}`);
        } else if (req.params.step === 'verify' && flow.stage === 'otp') {
          const input = z.object({ csrf: z.string(), otp: z.string().min(1).max(32) }).strict().parse(req.body);
          requireInteraction(flow.challenge.expiresAt > Date.now(), 'challenge_expired');
          const login = await sha.verify(flow.challenge, input.otp); const userId = await member(login.identity.preferredUsername);
          ensure(userId === flow.userId, 'FORBIDDEN_SCOPE');
          await save(res, { uid, params: flow.params, clientId: flow.clientId, stage: 'consent', csrf: store.vault.nonce(), login, userId }, handle);
          res.redirect(303, `/interaction/${encodeURIComponent(uid)}`);
        } else if (req.params.step === 'consent' && flow.stage === 'consent') {
          const input = z.object({ csrf: z.string(), decision: z.enum(['allow', 'deny']), pii: z.literal('1').optional() }).strict().parse(req.body);
          await store.destroy('ShaFlow', handle); res.clearCookie(flowName(uid), options);
          if (input.decision === 'deny') { await provider.interactionFinished(req, res, { error: 'access_denied' }, { mergeWithLastSubmission: false }); return; }
          const requested = String(detail.params.scope ?? '').split(' ').filter(s => SCOPES.includes(s));
          const scopes = requested.filter(s => s !== PII_SCOPE || input.pii === '1'); ensure(scopes.some(s => s !== PII_SCOPE), 'FORBIDDEN_SCOPE');
          requireInteraction(flow.login.expiresAt > Date.now(), 'login_expired');
          const sessionId = randomUUID(); const grant = new provider.Grant({ accountId: flow.userId, clientId: flow.clientId });
          // Read scopes are both AS-listed (OIDC side, consent prompt) and resource scopes (access token audience/scope).
          grant.addOIDCScope(scopes.join(' ')); grant.addResourceScope(settings.resource, scopes.join(' '));
          // A declined profile.pii is recorded as rejected so the consent prompt does not re-ask in a loop.
          if (requested.includes(PII_SCOPE) && !scopes.includes(PII_SCOPE)) { grant.rejectOIDCScope(PII_SCOPE); grant.rejectResourceScope(settings.resource, PII_SCOPE); }
          const grantId = await grant.save();
          try {
            const session = await store.createSession({ ...flow.login, userId: flow.userId, clientId: flow.clientId, grantId, scopes, resource: settings.resource }, sessionId);
            const manageHandle = store.vault.nonce(); await store.put('Management', manageHandle, { sessionId: session.id, csrf: store.vault.nonce() }, Math.min(28800, Math.floor((session.expiresAt - Date.now()) / 1000)));
            res.cookie(management, manageHandle, { ...options, maxAge: Math.min(28800000, session.expiresAt - Date.now()) });
            await provider.interactionFinished(req, res, { login: { accountId: flow.userId }, consent: { grantId } }, { mergeWithLastSubmission: false });
          } catch (error) { await store.revokeGrant(grantId); throw error; }
        } else throw new AppError('INVALID_INPUT');
      } catch (error) {
        await store.destroy('ShaFlow', handle);
        const safe = error instanceof ZodError ? new AppError('INVALID_INPUT') : publicError(error);
        // Only the request which claimed this flow may rotate it after failure. A stale
        // POST cannot clear cookies, replace a winning request, or replay SHA credentials.
        if (['login', 'verify', 'restart'].includes(String(req.params.step)) && safe.code !== 'STORE_UNAVAILABLE') {
          const notice = reportInteractionFailure(safe, res.locals.requestId, String(req.params.step));
          await save(res, { ...base(flow), stage: 'login', notice });
          res.redirect(303, `/interaction/${encodeURIComponent(uid)}`);
        } else throw error;
      }
    } finally { if (req.body) { delete req.body.password; delete req.body.otp; } }
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
