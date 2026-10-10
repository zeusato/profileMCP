import Provider, { errors, interactionPolicy } from 'oidc-provider';
import type { Settings } from './config.js';
import { SCOPES } from './config.js';
import { Store, oidcAdapter } from './store.js';
import { AppError, ensure } from './errors.js';
export function createProvider(settings: Settings, store: Store) {
  const policy = interactionPolicy.base();
  policy.get('login')!.checks.add(new interactionPolicy.Check('sha_connection_login', 'A fresh SHA connection is required', ctx => !ctx.oidc.result?.login));
  const provider = new Provider(settings.issuer, {
    adapter: oidcAdapter(store), clients: settings.clients,
    jwks: settings.signingKeys as any,
    cookies: { keys: settings.cookieKeys, short: { httpOnly: true, sameSite: 'lax', secure: settings.environment !== 'local' }, long: { httpOnly: true, sameSite: 'lax', secure: settings.environment !== 'local' } },
    // MCP clients register (DCR) and authorize with the protected-resource scopes; the AS must list them or /reg returns invalid_client_metadata.
    // They are therefore also OIDC-level scopes for the consent prompt, so consent grants them on both the OIDC and resource sides.
    scopes: SCOPES, claims: {}, responseTypes: ['code'],
    pkce: { required: () => true },
    clientBasedCORS: (_ctx, origin) => origin === settings.origin,
    features: {
      devInteractions: { enabled: false }, registration: { enabled: true, issueRegistrationAccessToken: false }, revocation: { enabled: true },
      userinfo: { enabled: false },
      resourceIndicators: { enabled: true, defaultResource: () => settings.resource, useGrantedResource: () => true,
        async getResourceServerInfo(ctx, resource) {
          if (resource !== settings.resource) throw new errors.InvalidTarget();
          let ttl = 600;
          if (ctx.oidc.grant?.jti) {
            try { ttl = Math.max(1, Math.min(ttl, Math.floor(((await store.sessionByGrant(ctx.oidc.grant.jti)).expiresAt - Date.now()) / 1000))); }
            catch (error) { if (!(error instanceof AppError && error.code === 'REAUTH_REQUIRED')) throw error; }
          }
          return { scope: SCOPES.join(' '), audience: settings.resource, accessTokenTTL: ttl, accessTokenFormat: 'opaque' };
        } },
    },
    extraClientMetadata: {
      properties: ['profile_mcp_client'],
      validator(_ctx, _key, _value, metadata) {
        if (settings.clients.some(c => c.client_id === metadata.client_id)) return;
        const allowed = ['https://chatgpt.com/connector_platform_oauth_redirect', 'https://claude.ai/api/mcp/auth_callback'];
        if (!Array.isArray(metadata.redirect_uris) || metadata.redirect_uris.length !== 1 || !allowed.includes(metadata.redirect_uris[0]!)) throw new errors.InvalidClientMetadata('Redirect URI is not approved');
        if (!['none', 'client_secret_post', 'client_secret_basic'].includes(metadata.token_endpoint_auth_method ?? 'client_secret_basic')) throw new errors.InvalidClientMetadata('Unsupported token authentication');
        if (metadata.jwks_uri || metadata.request_uris || metadata.initiate_login_uri || metadata.sector_identifier_uri) throw new errors.InvalidClientMetadata('Remote client metadata URLs are not supported');
      },
    },
    interactions: { policy, url: (_ctx, interaction) => `/interaction/${interaction.uid}` },
    ttl: { AuthorizationCode: 60, AccessToken: 600, RefreshToken: 3600, Grant: 28800, Interaction: 600, Session: 28800 },
    issueRefreshToken: (_ctx, client) => client.grantTypeAllowed('refresh_token'), rotateRefreshToken: true,
    async findAccount(_ctx, id, token) {
      try {
        if (!await store.rpc('member.by-id', { userId: id, teamId: store.teamId })) return undefined;
        if (token?.grantId) { const session = await store.sessionByGrant(token.grantId); if (session.userId !== id || token.clientId !== session.clientId) return undefined; }
        return { accountId: id, claims: async () => ({ sub: id }) };
      } catch (error) { if (error instanceof AppError && error.code === 'REAUTH_REQUIRED') return undefined; throw error; }
    },
    renderError: async (ctx, out) => { ctx.status = out.error === 'server_error' ? 503 : 400; ctx.body = { error: out.error }; },
  });
  provider.proxy = settings.environment !== 'local';
  provider.use(async (ctx, next) => {
    if (ctx.path === '/reg' && ctx.method === 'POST') { await store.quota('client-registration', 60, 3600); await store.quota(`client-registration:${ctx.ip}`, 10, 3600); }
    await next();
  });
  // Provider protocol errors are sanitized; do not attach error/HTTP objects to logs.
  provider.on('server_error', () => {});
  // Registration rejections log only the error code, an allowlisted reason and metadata field names; never values.
  provider.on('registration_create.error', (ctx, error: any) => {
    const fields = Object.keys(ctx.oidc?.body ?? {}).filter(k => /^[a-z_]{1,64}$/.test(k)).sort().slice(0, 40);
    const code = typeof error?.error === 'string' && /^[a-z_]{1,40}$/.test(error.error) ? error.error : 'unclassified';
    console.warn(JSON.stringify({ event: 'oauth.registration_rejected', error: code, reason: REGISTRATION_REASONS.includes(error?.error_description) ? error.error_description : 'unclassified', fields }));
  });
  return provider;
}
const REGISTRATION_REASONS = ['scope must only contain Authorization Server supported scope values', 'Redirect URI is not approved', 'Unsupported token authentication', 'Remote client metadata URLs are not supported'];
export async function authenticate(provider: Provider, store: Store, bearer: string, resource: string) {
  const token = await provider.AccessToken.find(bearer);
  ensure(token && !token.isExpired && token.aud === resource && token.accountId && token.grantId, 'UNAUTHENTICATED');
  const session = await store.sessionByGrant(token.grantId);
  ensure(token.accountId === session.userId && token.clientId === session.clientId && token.grantId === session.grantId && session.resource === resource, 'UNAUTHENTICATED');
  ensure(await provider.Grant.find(token.grantId), 'UNAUTHENTICATED');
  const scopes = (token.scope ?? '').split(' ').filter(Boolean);
  ensure(scopes.length && scopes.every(s => session.scopes.includes(s)), 'FORBIDDEN_SCOPE');
  return { session, scopes };
}
