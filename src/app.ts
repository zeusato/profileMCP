import express from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { SCOPES, type Settings } from './config.js';
import { Store } from './store.js';
import { ShaTransport } from './sha/transport.js';
import { ShaAuth, type AuthGateway } from './sha/auth.js';
import { createProvider, authenticate } from './oauth.js';
import { interactions } from './interactions.js';
import { ReadService } from './service.js';
import { handleMcp } from './mcp.js';
import { AppError, ensure, publicError, InteractionError } from './errors.js';
import { page, escapeHtml, contentSecurityPolicy } from './web.js';
export function createApp(settings: Settings, store: Store, auth: AuthGateway = new ShaAuth(new ShaTransport(), settings.liveAuth), reads = new ShaTransport()) {
  const app = express(); const provider = createProvider(settings, store); const service = new ReadService(store, reads);
  app.disable('x-powered-by'); app.set('trust proxy', settings.environment !== 'local');
  app.use((req, res, next) => {
    // same-origin, not no-referrer: under no-referrer browsers send "Origin: null" on form POSTs, which the Origin checks reject.
    // Cross-origin navigations (e.g. the redirect carrying the code) still get no Referer.
    res.locals.requestId = randomUUID(); res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': contentSecurityPolicy(), 'X-Request-Id': res.locals.requestId });
    if (settings.environment !== 'local') res.set('Strict-Transport-Security', 'max-age=31536000');
    if (req.headers.host !== new URL(settings.origin).host) { res.status(421).json({ error: 'INVALID_HOST' }); return; }
    if (req.headers.origin && req.headers.origin !== settings.origin) { res.status(403).json({ error: 'INVALID_ORIGIN' }); return; }
    next();
  });
  app.get('/', (_req, res) => res.type('html').send(page('Dữ liệu SHA, trong quyền của bạn.', `<p>Kết nối trợ lý với tài khoản SHA cá nhân để tra cứu. Mỗi kết nối có phiên xác thực và quyền đọc riêng.</p><section><p>Địa chỉ MCP</p><code>${escapeHtml(settings.resource)}</code><p>Thêm địa chỉ này vào client MCP hỗ trợ OAuth, sau đó đăng nhập SHA và cấp quyền trên website.</p><a class="button" href="/connections">Quản lý kết nối hiện tại</a></section><small>API tra cứu chỉ xuất hiện sau khi được kiểm chứng. GPT và Claude đang chờ nghiệm thu trên môi trường thật.</small>`)));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'profile-mcp', version: '0.1.0' }));
  app.get('/api/ready', async (_req, res) => { const state = await store.rpc('health', {}); ensure(state?.version >= '20261009_002', 'STORE_UNAVAILABLE'); res.json({ status: 'ready' }); });
  const metadata = (_req: express.Request, res: express.Response) => res.json({ resource: settings.resource, authorization_servers: [settings.issuer], scopes_supported: SCOPES, bearer_methods_supported: ['header'], resource_name: 'Profile MCP SHA' });
  app.get('/.well-known/oauth-protected-resource/api/mcp', metadata); app.get('/.well-known/oauth-protected-resource', metadata);
  app.all('/api/mcp', express.json({ limit: '128kb', strict: true }), async (req, res) => {
    const challenge = `Bearer resource_metadata="${settings.origin}/.well-known/oauth-protected-resource/api/mcp"`;
    try {
      ensure(typeof req.headers.authorization === 'string' && /^Bearer [A-Za-z0-9._~-]{20,4096}$/.test(req.headers.authorization), 'UNAUTHENTICATED');
      const { session, scopes } = await authenticate(provider, store, req.headers.authorization.slice(7), settings.resource);
      if (req.method !== 'POST') { res.set('Allow', 'POST').status(405).end(); return; }
      await handleMcp(req, res, service, session, scopes, res.locals.requestId);
    } catch (error) {
      const safe = publicError(error); const authError = ['UNAUTHENTICATED', 'REAUTH_REQUIRED'].includes(safe.code);
      if (authError) res.set('WWW-Authenticate', challenge); res.status(authError ? 401 : safe.status).json({ error: safe.code, requestId: res.locals.requestId });
    }
  });
  interactions(app, provider, settings, store, auth);
  app.use(async (req, res, next) => { try { await provider.callback()(req, res); } catch (error) { next(error); } });
  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const safe = error instanceof ZodError ? new AppError('INVALID_INPUT') : publicError(error);
    if (res.headersSent) { res.end(); return; }
    if (req.path.startsWith('/interaction') || req.path.startsWith('/connections')) {
      const step = /^\/interaction\/[^/]+\/(login|verify|consent)$/.exec(req.path)?.[1] ?? 'page';
      console.warn(JSON.stringify({ event: 'oauth.interaction_failed', requestId: res.locals.requestId, step, error: safe.code, reason: error instanceof InteractionError ? error.reason : 'unclassified' }));
      const guidance = step === 'login'
        ? 'Chưa chuyển được tới bước OTP. Hãy đóng các trang kết nối cũ và bắt đầu kết nối lại từ ứng dụng, rồi hoàn tất trong cùng cửa sổ trình duyệt.'
        : 'Hãy bắt đầu kết nối lại từ ứng dụng. Hệ thống không tự gửi lại yêu cầu xác thực.';
      res.status(safe.status).type('html').send(page('Chưa hoàn tất kết nối', `<p>${escapeHtml(safe.code)}</p><p>${guidance}</p><small>Mã hỗ trợ: ${escapeHtml(res.locals.requestId)}</small>`));
    }
    else res.status(safe.status).json({ error: safe.code, requestId: res.locals.requestId });
  });
  return { app, provider, service };
}
