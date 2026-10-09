import { randomUUID } from 'node:crypto';
import { AppError, ensure } from '../errors.js';
import type { Json } from '../store.js';
import { isEnabled, route } from './catalog.js';
import type { ReadRequest } from './requests.js';
const HOST = 'https://api.shs.com.vn';
export type Fetcher = typeof fetch;
export async function boundedJson(response: Response): Promise<unknown> {
  ensure(response.headers.get('content-type')?.toLowerCase().includes('application/json'));
  ensure(response.body); const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; bytes += value.length; ensure(bytes <= 2 * 1024 * 1024); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError('UPSTREAM_SHAPE_CHANGED'); }
}
export function envelope(raw: unknown): unknown {
  ensure(raw && typeof raw === 'object' && !Array.isArray(raw)); const x = raw as Json;
  if (x.code === 401 || x.code === '401' || x.code === 403 || x.code === '403') throw new AppError('UPSTREAM_AUTH_FAILED', 401);
  if (x.code !== 200 && x.code !== '200') throw new AppError('UPSTREAM_REJECTED', 502);
  ensure(Object.hasOwn(x, 'data')); return x.data;
}
export class ShaTransport {
  constructor(private readonly fetcher: Fetcher = fetch) {}
  private async send(method: string, path: string, query: Json, body?: Json, bearer?: string, signal?: AbortSignal): Promise<unknown> {
    const url = new URL(path, HOST); ensure(url.origin === HOST && url.pathname === path && !url.search && !url.hash, 'FORBIDDEN_SCOPE');
    for (const [k, v] of Object.entries(query)) { ensure(v !== undefined && (typeof v === 'string' || typeof v === 'number'), 'INVALID_INPUT'); url.searchParams.set(k, String(v)); }
    const abort = signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000);
    try {
      const response = await this.fetcher(url, { method, redirect: 'error', signal: abort, headers: {
        Accept: 'application/json', 'Accept-Language': 'vi', 'Correlation-Id': randomUUID(),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}),
      }, body: body ? JSON.stringify(body) : undefined });
      if (response.status === 401 || response.status === 403) throw new AppError('UPSTREAM_AUTH_FAILED', 401);
      if (response.status === 429) throw new AppError('RATE_LIMITED', 429);
      if (response.status !== 200) throw new AppError('UPSTREAM_REJECTED', 502);
      return await boundedJson(response);
    } catch (e) { if (e instanceof AppError) throw e; throw new AppError(abort.aborted ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_REJECTED', 502); }
  }
  async read(request: ReadRequest, bearer: string, signal?: AbortSignal) {
    ensure(isEnabled(request.operation), 'CAPABILITY_UNAVAILABLE'); return this.checkedRead(request, bearer, signal);
  }
  private async checkedRead(request: ReadRequest, bearer: string, signal?: AbortSignal) {
    const r = route(request.operation); ensure(request.method === r.method && request.path === r.path && r.host === HOST, 'FORBIDDEN_SCOPE');
    const raw = await this.send(r.method, r.path, request.query, request.body, bearer, signal);
    return request.operation === 'market.candles' ? raw : envelope(raw);
  }
  async bootstrap(operation: 'identity.current' | 'accounts.tree', bearer: string, signal?: AbortSignal) {
    ensure(operation === 'identity.current' || operation === 'accounts.tree', 'FORBIDDEN_SCOPE');
    const r = route(operation); return this.checkedRead({ operation, method: r.method, path: r.path, query: {}, accountNos: [] }, bearer, signal);
  }
  async auth(step: 'login-v2' | 'generate-matrix' | 'verify-sotp', body: Json) {
    const fields = {
      'login-v2': ['username', 'password'],
      'generate-matrix': ['username', 'sessionKey', 'trustDevice', 'otpType'],
      'verify-sotp': ['username', 'sessionKey', 'trustDevice', 'otpType', 'transactionId', 'otp'],
    };
    ensure(Object.hasOwn(fields, step) && Object.keys(body).length === fields[step].length && fields[step].every(k => Object.hasOwn(body, k)), 'INVALID_INPUT');
    return envelope(await this.send('POST', `/prod/v1/author-service/p/auth/${step}`, {}, body));
  }
}
