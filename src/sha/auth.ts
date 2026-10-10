import { decodeJwt } from 'jose';
import { z } from 'zod';
import { AppError, ensure } from '../errors.js';
import type { Json } from '../store.js';
import { parseEntitlements, parseIdentity } from '../policy.js';
import { ShaTransport } from './transport.js';
// Live 10/10/2026: login-v2 returns trustDevice null; it is forwarded unchanged to generate-matrix/verify-sotp.
const loginSchema = z.object({ username: z.string().min(1), sessionKey: z.string().min(1), trustDevice: z.union([z.boolean(), z.string(), z.number(), z.null()]), otpType: z.array(z.union([z.number(), z.string()])) });
const matrixSchema = z.object({ username: z.string(), otpIndex: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]), transactionId: z.string().min(1), remainSeconds: z.number().positive().max(3600) });
const tokenSchema = z.object({ access_token: z.string().min(1), token_type: z.string().refine(x => x.toLowerCase() === 'bearer'), expires_in: z.number().int().positive() });
export interface Challenge { username: string; sessionKey: string; trustDevice: string | number | boolean | null; otpType: 2; transactionId: string; otpIndex: string | (string | number)[]; expiresAt: number }
export interface ShaLogin { bearer: string; expiresAt: number; identity: Json; entitlements: Json }
export interface AuthGateway { begin(username: string, password: string): Promise<Challenge>; verify(challenge: Challenge, otp: string): Promise<ShaLogin> }
const kind = (v: unknown) => v === null ? 'null' : Array.isArray(v) ? `array<${[...new Set(v.map(x => x === null ? 'null' : typeof x))].join('|')}>` : typeof v;
// Schema mismatch diagnostics: schema paths, issue codes and value kinds only, never values.
function parseOrReport<T extends z.ZodType>(schema: T, raw: unknown, step: string): z.infer<T> {
  const parsed = schema.safeParse(raw); if (parsed.success) return parsed.data;
  const at = (path: PropertyKey[]) => path.reduce<any>((v, k) => v?.[k as any], raw);
  console.warn(JSON.stringify({ event: 'sha.shape_mismatch', step, issues: parsed.error.issues.slice(0, 10).map(i => ({ path: i.path.map(String).filter(p => /^[A-Za-z0-9_]{1,40}$/.test(p)).join('.'), code: i.code, received: kind(at(i.path)) })) }));
  throw new AppError('UPSTREAM_SHAPE_CHANGED');
}
export class ShaAuth implements AuthGateway {
  constructor(private readonly transport: ShaTransport, private readonly liveEnabled: boolean) {}
  async begin(username: string, password: string): Promise<Challenge> {
    ensure(this.liveEnabled, 'CAPABILITY_UNAVAILABLE');
    const login = parseOrReport(loginSchema, await this.transport.auth('login-v2', { username, password }), 'login-v2');
    if (login.username !== username || !login.otpType.some(t => String(t) === '2')) {
      console.warn(JSON.stringify({ event: 'sha.login_mismatch', username: login.username === username ? 'exact' : login.username.toLowerCase() === username.toLowerCase() ? 'case-only' : 'different', otpTypes: login.otpType.map(String).filter(t => /^\d{1,3}$/.test(t)) }));
      throw new AppError('CAPABILITY_UNAVAILABLE');
    }
    const matrix = parseOrReport(matrixSchema, await this.transport.auth('generate-matrix', { username, sessionKey: login.sessionKey, trustDevice: login.trustDevice, otpType: login.otpType }), 'generate-matrix');
    ensure(matrix.username === username);
    return { username, sessionKey: login.sessionKey, trustDevice: login.trustDevice, otpType: 2, transactionId: matrix.transactionId, otpIndex: matrix.otpIndex, expiresAt: Date.now() + Math.min(matrix.remainSeconds, 300) * 1000 };
  }
  async verify(c: Challenge, otp: string): Promise<ShaLogin> {
    ensure(this.liveEnabled, 'CAPABILITY_UNAVAILABLE'); if (c.expiresAt <= Date.now()) throw new AppError('REAUTH_REQUIRED');
    const t = parseOrReport(tokenSchema, await this.transport.auth('verify-sotp', { username: c.username, sessionKey: c.sessionKey, trustDevice: c.trustDevice, otpType: c.otpType, transactionId: c.transactionId, otp }), 'verify-sotp');
    let expiresAt = Date.now() + t.expires_in * 1000;
    // Metadata only, from this TLS login response; never accepts client-provided SHA JWTs.
    try { const claims = decodeJwt(t.access_token); if (typeof claims.exp === 'number') expiresAt = Math.min(expiresAt, claims.exp * 1000); } catch {}
    expiresAt -= 60000; ensure(expiresAt > Date.now(), 'REAUTH_REQUIRED');
    const identity = parseIdentity(await this.transport.bootstrap('identity.current', t.access_token), c.username);
    const entitlements = parseEntitlements(await this.transport.bootstrap('accounts.tree', t.access_token) as Json, identity);
    return { bearer: t.access_token, expiresAt, identity, entitlements };
  }
}
