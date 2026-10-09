import { z } from 'zod';
import type { ClientMetadata } from 'oidc-provider';
export const SCOPES = ['profile.read', 'accounts.read', 'assets.read', 'orders.read', 'credit.read', 'reports.read', 'research.read', 'market.read'];
export interface Settings {
  origin: string; resource: string; issuer: string; databaseUrl: string; databaseCa?: string; teamId: string;
  keyring: { active: string; keys: Record<string, string> }; hmacKey: string;
  cookieKeys: string[]; signingKeys: { keys: Record<string, unknown>[] };
  clients: ClientMetadata[]; liveAuth: boolean; environment: 'production' | 'preview' | 'local';
}
export function readSettings(env = process.env): Settings {
  const s = z.object({
    APP_ORIGIN: z.url(), MCP_RESOURCE_URL: z.url(), OAUTH_ISSUER: z.url(), DATABASE_URL: z.string().min(1), DATABASE_CA_CERT: z.string().optional(),
    AUTH_ALLOWED_TEAM_ID: z.uuid(), SESSION_ENCRYPTION_KEYRING: z.string(), TOKEN_HMAC_KEY: z.string(),
    COOKIE_SECRET: z.string().min(32), OAUTH_SIGNING_KEYS: z.string(), OAUTH_CLIENTS: z.string().default('[]'),
    SHA_LIVE_AUTH_ENABLED: z.enum(['true', 'false']).default('false'),
    SHA_REFRESH_ENABLED: z.literal('false').default('false'),
    SHA_UPSTREAM_BASE_URL: z.literal('https://api.shs.com.vn').default('https://api.shs.com.vn'),
    APP_ENV: z.enum(['production', 'preview', 'local']).default('production'),
  }).parse(env);
  const origin = new URL(s.APP_ORIGIN);
  if (origin.origin !== s.APP_ORIGIN || (origin.protocol !== 'https:' && !(s.APP_ENV === 'local' && origin.hostname === '127.0.0.1'))) throw new Error('Invalid canonical origin');
  if (s.OAUTH_ISSUER !== s.APP_ORIGIN || s.MCP_RESOURCE_URL !== `${s.APP_ORIGIN}/api/mcp`) throw new Error('Issuer/resource mismatch');
  if (s.APP_ENV === 'preview' && s.SHA_LIVE_AUTH_ENABLED === 'true') throw new Error('Live SHA credentials are prohibited in preview');
  const db = new URL(s.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || ['postgres', 'service_role', 'supabase_admin'].includes(decodeURIComponent(db.username).split('.')[0]!)) throw new Error('Dedicated database runtime role required');
  const keyring = z.object({ active: z.string(), keys: z.record(z.string(), z.string()) }).parse(JSON.parse(s.SESSION_ENCRYPTION_KEYRING));
  if (!keyring.keys[keyring.active] || Object.values(keyring.keys).some(k => Buffer.from(k, 'base64url').length !== 32) || Buffer.from(s.TOKEN_HMAC_KEY, 'base64url').length !== 32) throw new Error('Invalid encryption/HMAC keys');
  const clients = JSON.parse(s.OAUTH_CLIENTS) as ClientMetadata[];
  for (const c of clients) {
    if (!c.client_id || !c.redirect_uris?.length || c.redirect_uris.some(uri => { const u = new URL(uri); return u.protocol !== 'https:' || !!u.hash || !!u.username || !!u.password; })) throw new Error('Pre-registered HTTPS redirect required');
  }
  return { origin: s.APP_ORIGIN, resource: s.MCP_RESOURCE_URL, issuer: s.OAUTH_ISSUER, databaseUrl: s.DATABASE_URL, databaseCa: s.DATABASE_CA_CERT, teamId: s.AUTH_ALLOWED_TEAM_ID,
    keyring, hmacKey: s.TOKEN_HMAC_KEY, cookieKeys: s.COOKIE_SECRET.split(','), signingKeys: JSON.parse(s.OAUTH_SIGNING_KEYS), clients,
    liveAuth: s.SHA_LIVE_AUTH_ENABLED === 'true', environment: s.APP_ENV };
}
