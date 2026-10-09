import { decodeJwt } from 'jose';
import { z } from 'zod';
import { AppError, ensure } from '../errors.js';
import type { Json } from '../store.js';
import { parseEntitlements, parseIdentity } from '../policy.js';
import { ShaTransport } from './transport.js';
const loginSchema = z.object({ username: z.string().min(1), sessionKey: z.string().min(1), trustDevice: z.union([z.boolean(), z.string(), z.number()]), otpType: z.array(z.union([z.number(), z.string()])) });
const matrixSchema = z.object({ username: z.string(), otpIndex: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]), transactionId: z.string().min(1), remainSeconds: z.number().positive().max(3600) });
const tokenSchema = z.object({ access_token: z.string().min(1), token_type: z.string().refine(x => x.toLowerCase() === 'bearer'), expires_in: z.number().int().positive() });
export interface Challenge { username: string; sessionKey: string; trustDevice: string | number | boolean; otpType: 2; transactionId: string; otpIndex: string | (string | number)[]; expiresAt: number }
export interface ShaLogin { bearer: string; expiresAt: number; identity: Json; entitlements: Json }
export interface AuthGateway { begin(username: string, password: string): Promise<Challenge>; verify(challenge: Challenge, otp: string): Promise<ShaLogin> }
export class ShaAuth implements AuthGateway {
  constructor(private readonly transport: ShaTransport, private readonly liveEnabled: boolean) {}
  async begin(username: string, password: string): Promise<Challenge> {
    ensure(this.liveEnabled, 'CAPABILITY_UNAVAILABLE');
    const parsed = loginSchema.safeParse(await this.transport.auth('login-v2', { username, password }));
    ensure(parsed.success); const login = parsed.data;
    ensure(login.username === username && login.otpType.some(t => String(t) === '2'), 'CAPABILITY_UNAVAILABLE');
    const matrix = matrixSchema.safeParse(await this.transport.auth('generate-matrix', { username, sessionKey: login.sessionKey, trustDevice: login.trustDevice, otpType: login.otpType }));
    ensure(matrix.success && matrix.data.username === username);
    return { username, sessionKey: login.sessionKey, trustDevice: login.trustDevice, otpType: 2, transactionId: matrix.data.transactionId, otpIndex: matrix.data.otpIndex, expiresAt: Date.now() + Math.min(matrix.data.remainSeconds, 300) * 1000 };
  }
  async verify(c: Challenge, otp: string): Promise<ShaLogin> {
    ensure(this.liveEnabled, 'CAPABILITY_UNAVAILABLE'); if (c.expiresAt <= Date.now()) throw new AppError('REAUTH_REQUIRED');
    const parsed = tokenSchema.safeParse(await this.transport.auth('verify-sotp', { username: c.username, sessionKey: c.sessionKey, trustDevice: c.trustDevice, otpType: c.otpType, transactionId: c.transactionId, otp }));
    ensure(parsed.success); const t = parsed.data;
    let expiresAt = Date.now() + t.expires_in * 1000;
    // Metadata only, from this TLS login response; never accepts client-provided SHA JWTs.
    try { const claims = decodeJwt(t.access_token); if (typeof claims.exp === 'number') expiresAt = Math.min(expiresAt, claims.exp * 1000); } catch {}
    expiresAt -= 60000; ensure(expiresAt > Date.now(), 'REAUTH_REQUIRED');
    const identity = parseIdentity(await this.transport.bootstrap('identity.current', t.access_token), c.username);
    const entitlements = parseEntitlements(await this.transport.bootstrap('accounts.tree', t.access_token) as Json, identity);
    return { bearer: t.access_token, expiresAt, identity, entitlements };
  }
}
