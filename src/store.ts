import postgres from 'postgres';
import type { AdapterPayload } from 'oidc-provider';
import { errors } from 'oidc-provider';
import { randomUUID } from 'node:crypto';
import { Vault } from './crypto.js';
import { AppError } from './errors.js';
export type Json = Record<string, any>;
export type Rpc = (action: string, payload: Json) => Promise<any>;
export interface Session {
  id: string; userId: string; teamId: string; generation: number; clientId: string; grantId: string;
  expiresAt: number; scopes: string[]; bearer: string; identity: Json; entitlements: Json; resource: string;
}
export function postgresRpc(url: string, ca?: string): { rpc: Rpc; close: () => Promise<void> } {
  const sql = postgres(url, { ssl: { rejectUnauthorized: true, ca }, max: 2, prepare: false, idle_timeout: 20, connect_timeout: 8, onnotice: () => {} });
  return { rpc: async (action, payload) => {
    try { const rows = await sql`select profile_mcp.runtime_rpc(${action}, ${sql.json(payload)}) as result`; return rows[0]?.result; }
    catch { throw new AppError('STORE_UNAVAILABLE', 503); }
  }, close: () => sql.end({ timeout: 2 }) };
}
export class Store {
  constructor(readonly rpc: Rpc, readonly vault: Vault, readonly teamId: string) {}
  async put(model: string, id: string, payload: Json, ttl: number) {
    const digest = this.vault.digest(`${model}:${id}`);
    await this.rpc('artifact.put', { model, id: digest, ciphertext: this.vault.seal(payload, `artifact:${model}:${digest}`), keyId: this.vault.keyId,
      grant: payload.grantId ? this.vault.digest(`grant:${payload.grantId}`) : model === 'Grant' ? this.vault.digest(`grant:${id}`) : null,
      uid: payload.uid ? this.vault.digest(`uid:${payload.uid}`) : null, ttl: model === 'Client' ? 0 : Math.min(ttl, 604800) });
  }
  async get(model: string, id: string, byUid = false): Promise<Json | undefined> {
    const row = await this.rpc('artifact.get', { model, id: this.vault.digest(`${byUid ? 'uid' : model}:${id}`), byUid });
    if (!row) return undefined;
    const payload = this.vault.open<Json>(row.ciphertext, `artifact:${model}:${row.id}`);
    return row.consumed ? { ...payload, consumed: row.consumed } : payload;
  }
  async consume(model: string, id: string) { return !!await this.rpc('artifact.consume', { model, id: this.vault.digest(`${model}:${id}`) }); }
  async destroy(model: string, id: string) { await this.rpc('artifact.destroy', { model, id: this.vault.digest(`${model}:${id}`) }); }
  async revokeGrant(id: string) { await this.rpc('grant.revoke', { grant: this.vault.digest(`grant:${id}`), teamId: this.teamId }); }
  // SHA IDs are case-insensitive, so allowlist subjects are lowercase; the exact-case lookup keeps entries provisioned before 10/10/2026 working.
  async member(username: string): Promise<string> {
    for (const subject of new Set([username.toLowerCase(), username])) {
      const row = await this.rpc('member.get', { teamId: this.teamId, subject: this.vault.digest(`sha:preferredUsername:${subject}`) });
      if (row) return row.userId;
    }
    throw new AppError('FORBIDDEN_SCOPE', 403);
  }
  async createSession(value: Omit<Session, 'id' | 'teamId' | 'generation'>, id = randomUUID()): Promise<Session> {
    const s = { ...value, id, teamId: this.teamId, generation: 1 };
    const aad = `session:${s.id}:${s.userId}:${s.teamId}:1`;
    await this.rpc('session.create', { id: s.id, userId: s.userId, teamId: s.teamId, clientId: s.clientId, grant: this.vault.digest(`grant:${s.grantId}`),
      expiresAt: new Date(s.expiresAt).toISOString(), scopes: s.scopes, resource: s.resource, ciphertext: this.vault.seal(s, aad), keyId: this.vault.keyId });
    return s;
  }
  async session(id: string, grantId?: string): Promise<Session> {
    const row = await this.rpc('session.get', { id, grant: grantId ? this.vault.digest(`grant:${grantId}`) : undefined, teamId: this.teamId });
    if (!row) throw new AppError('REAUTH_REQUIRED', 401);
    id = row.id;
    const s = this.vault.open<Session>(row.ciphertext, `session:${id}:${row.userId}:${this.teamId}:${row.generation}`);
    if (s.id !== id || s.teamId !== this.teamId || s.userId !== row.userId || s.generation !== Number(row.generation) || s.expiresAt <= Date.now()) throw new AppError('REAUTH_REQUIRED', 401);
    return s;
  }
  async sessionByGrant(grantId: string) { return this.session('', grantId); }
  async fence(s: Session) { const fresh = await this.session(s.id); if (fresh.generation !== s.generation || fresh.userId !== s.userId || fresh.grantId !== s.grantId) throw new AppError('REAUTH_REQUIRED', 401); }
  async revoke(s: Session) { await this.rpc('session.revoke', { id: s.id, userId: s.userId, teamId: s.teamId }); }
  async quota(key: string, limit: number, seconds = 60) {
    if (!await this.rpc('quota.take', { key: this.vault.digest(`quota:${key}`), limit, seconds })) throw new AppError('RATE_LIMITED', 429);
  }
  async acquire(s: Session) { const id = randomUUID(); const owner = this.vault.digest(`lease:${s.teamId}:${s.userId}`); if (!await this.rpc('lease.acquire', { id, owner })) throw new AppError('RATE_LIMITED', 429); return async () => { await this.rpc('lease.release', { id, owner }); }; }
  async audit(s: Session, requestId: string, operation: string, result: string, duration: number) { await this.rpc('audit.write', { requestId, subject: this.vault.digest(`audit:${s.userId}`), operation, result, duration }); }
}
export function oidcAdapter(store: Store) {
  return class {
    constructor(readonly model: string) {}
    async upsert(id: string, payload: AdapterPayload, ttl = 600) { await store.put(this.model, id, payload, ttl); }
    async find(id: string) { return await store.get(this.model, id) as AdapterPayload | undefined; }
    async findByUid(uid: string) { return await store.get(this.model, uid, true) as AdapterPayload | undefined; }
    async findByUserCode() { return undefined; }
    async consume(id: string) { if (!await store.consume(this.model, id)) throw new errors.InvalidGrant('Artifact already consumed or expired'); }
    async destroy(id: string) { await store.destroy(this.model, id); }
    async revokeByGrantId(id: string) { await store.revokeGrant(id); }
  };
}
