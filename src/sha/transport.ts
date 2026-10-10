import { randomUUID } from 'node:crypto';
import { AppError, ensure } from '../errors.js';
import type { Json } from '../store.js';
import { isEnabled, route } from './catalog.js';
import type { ReadRequest } from './requests.js';
const HOST = 'https://api.shs.com.vn';
const PUBLIC_AUTH_BEARER = 'null';
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
  // `step` (control plane only) enables one sanitized diagnostic line per upstream call; read operations pass none.
  private async send(method: string, path: string, query: Json, body?: Json, bearer?: string, signal?: AbortSignal, step?: string, sessionKey?: string): Promise<unknown> {
    const url = new URL(path, HOST); ensure(url.origin === HOST && url.pathname === path && !url.search && !url.hash, 'FORBIDDEN_SCOPE');
    for (const [k, v] of Object.entries(query)) { ensure(v !== undefined && (typeof v === 'string' || typeof v === 'number'), 'INVALID_INPUT'); url.searchParams.set(k, String(v)); }
    const abort = signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000);
    const started = Date.now(); const note = (d: Diagnostic) => { if (step) diagnose(step, started, d); };
    let response: Response;
    try {
      response = await this.fetcher(url, { method, redirect: 'error', signal: abort, headers: {
        Accept: 'application/json', 'Accept-Language': 'vi', 'Correlation-Id': randomUUID(),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(sessionKey ? { 'Session-Key': sessionKey } : {}),
      }, body: body ? JSON.stringify(body) : undefined });
    } catch (e: any) {
      const error = new AppError(abort.aborted ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_REJECTED', 502); note({ outcome: error.code, cause: e?.cause?.code ?? e?.name }); throw error;
    }
    const contentType = response.headers.get('content-type');
    if (response.status !== 200) {
      const error = response.status === 401 || response.status === 403 ? new AppError('UPSTREAM_AUTH_FAILED', 401) : response.status === 429 ? new AppError('RATE_LIMITED', 429) : new AppError('UPSTREAM_REJECTED', 502);
      const raw = step && /json/i.test(contentType ?? '') ? await boundedJson(response).catch(() => undefined) : undefined;
      note({ httpStatus: response.status, contentType, raw, outcome: error.code }); throw error;
    }
    try { const raw = await boundedJson(response); note({ httpStatus: 200, contentType, raw, outcome: 'received' }); return raw; }
    catch (e) { const error = e instanceof AppError ? e : new AppError(abort.aborted ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_REJECTED', 502); note({ httpStatus: 200, contentType, outcome: error.code }); throw error; }
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
    const r = route(operation); ensure(r.method === 'GET' && r.host === HOST, 'FORBIDDEN_SCOPE');
    return envelope(await this.send(r.method, r.path, {}, undefined, bearer, signal, operation));
  }
  async auth(step: 'login-v2' | 'generate-matrix' | 'verify-sotp', body: Json) {
    const fields = {
      'login-v2': ['username', 'password'],
      'generate-matrix': ['username', 'sessionKey', 'trustDevice', 'otpType'],
      'verify-sotp': ['username', 'sessionKey', 'trustDevice', 'otpType', 'transactionId', 'otp'],
    };
    ensure(Object.hasOwn(fields, step) && Object.keys(body).length === fields[step].length && fields[step].every(k => Object.hasOwn(body, k)), 'INVALID_INPUT');
    // After login-v2 the official web client also sends the login sessionKey as a Session-Key header; without it SHA answers code 405 "Session hết hạn".
    const sessionKey = step === 'login-v2' ? undefined : body.sessionKey; ensure(sessionKey === undefined || (typeof sessionKey === 'string' && /^[A-Za-z0-9-]{1,128}$/.test(sessionKey)), 'UPSTREAM_SHAPE_CHANGED');
    // The official SHA web client sends the literal "Authorization: Bearer null" on public auth calls (DevTools capture 10/10/2026).
    return envelope(await this.send('POST', `/prod/v1/author-service/p/auth/${step}`, {}, body, PUBLIC_AUTH_BEARER, undefined, step, sessionKey));
  }
}
interface Diagnostic { httpStatus?: number; contentType?: string | null; raw?: unknown; outcome: string; cause?: unknown }
const numeric = (v: unknown) => v === undefined || v === null ? null : /^-?\d{1,6}$/.test(String(v)) ? String(v) : 'non-numeric';
// Logs step, HTTP status, content-type class, envelope code/status and top-level key names. Never bodies, messages, usernames or tokens.
function diagnose(step: string, started: number, d: Diagnostic) {
  const raw = d.raw && typeof d.raw === 'object' && !Array.isArray(d.raw) ? d.raw as Json : undefined;
  const type = !d.contentType ? 'none' : /json/i.test(d.contentType) ? 'json' : /html/i.test(d.contentType) ? 'html' : 'other';
  const cause = typeof d.cause === 'string' && /^[A-Za-z][A-Za-z0-9_]{1,40}$/.test(d.cause) ? d.cause : null;
  console.warn(JSON.stringify({ event: 'sha.upstream', step, httpStatus: d.httpStatus ?? null, contentType: type, envelopeCode: numeric(raw?.code), envelopeStatus: numeric(raw?.status),
    keys: raw ? Object.keys(raw).filter(k => /^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(k)).slice(0, 16) : [], outcome: d.outcome, cause, ms: Date.now() - started }));
}
