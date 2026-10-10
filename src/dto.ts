import { Decimal } from 'decimal.js';
import type { Json } from './store.js';
import { ensure } from './errors.js';
import type { Policy } from './policy.js';
export function decimal(value: unknown, locale: 'dot' | 'vi' = 'dot'): string | null {
  if (value === null) return null;
  // JSON numbers arrive as JS numbers: finite fractions keep their shortest round-trip text; integers beyond 2^53 are rejected (precision already lost).
  ensure(typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))));
  const raw = String(value); ensure(raw.length <= 100);
  if (locale === 'vi') ensure(/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(raw));
  else ensure(/^-?\d+(?:\.\d+)?$/.test(raw));
  const d = new Decimal(locale === 'vi' ? raw.replaceAll('.', '').replace(',', '.') : raw); ensure(d.isFinite()); return d.toFixed();
}
export function pageCoverage(raw: Json, rows: unknown[], page: number, size: number, variant: 'page' | 'orders') {
  const p = raw[variant === 'page' ? 'page' : 'pageNo']; const n = raw[variant === 'page' ? 'size' : 'pageSize'];
  const total = raw[variant === 'page' ? 'totalElements' : 'totalCount']; const pages = raw[variant === 'page' ? 'totalPages' : 'totalPage'];
  ensure([p, n, total, pages].every(Number.isSafeInteger) && p === page && n === size && total >= 0 && pages >= 0 && rows.length <= size && rows.length <= total);
  ensure(pages === Math.ceil(total / size) && (total === 0 ? page === 1 && rows.length === 0 : page <= pages));
  ensure(rows.length === (page < pages ? size : total - (page - 1) * size));
  return { returned: rows.length, total, complete: pages <= 1 && page === 1, nextCursor: null, truncated: false, reason: pages <= 1 ? 'single-page' : 'partial-page', pagesFetched: 1, totalsScope: 'unknown' };
}
const at = (o: Json, path: string): unknown => path.split('.').reduce((v: any, k) => v == null ? undefined : v[k], o);
const put = (o: Json, path: string, value: unknown) => { const keys = path.split('.'); let p = o; for (const k of keys.slice(0, -1)) p = p[k] ??= {}; p[keys.at(-1)!] = value; };
export interface Field { raw: string; dto: string; unit: string; type?: string; scope?: string }
function convert(f: Field, v: unknown, policy: Policy): unknown {
  if (v === null) return null;
  switch (f.type) {
    case 'ref': ensure(typeof v === 'string' && v.length > 0 && v.length <= 100); return policy.ref(/subaccount/i.test(f.dto) ? 'sub' : /broker/i.test(f.dto) ? 'broker' : 'acct', v);
    case 'masked': ensure(typeof v === 'string' && v.length >= 3 && v.length <= 100); return `***${v.slice(-3)}`;
    case 'decimal': return decimal(v);
    case 'vi-decimal': return decimal(v, 'vi');
    case 'boolean': ensure(typeof v === 'boolean'); return v;
    case 'long-text': ensure(typeof v === 'string' && v.length <= 1_000_000); return v; // capped later by the operation (e.g. KMS content)
    case 'any': ensure((typeof v === 'string' && v.length <= 2000) || (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean'); return v;
    default: if (typeof v === 'number' && Number.isSafeInteger(v)) return String(v); ensure(typeof v === 'string' && v.length <= 2000); return v; // codes may arrive as numbers
  }
}
// Allowlisted projection of live-shaped fieldMaps (raw/dto paths with `[].` for arrays, dots for objects). Fields outside the map are dropped;
// profile.pii fields only with that scope; null is kept, a missing field is reported once per DTO path.
export function project(fields: Field[], root: unknown, policy: Policy, pii: boolean) {
  const missing = new Set<string>(); type Spec = { raw: string; dto: string; f: Field };
  const walk = (specs: Spec[], obj: unknown, prefix: string): Json => {
    ensure(obj && typeof obj === 'object' && !Array.isArray(obj)); const out: Json = {}; const groups = new Map<string, { key: string; dkey: string; specs: Spec[] }>();
    for (const s of specs) {
      const i = s.raw.indexOf('[].'); const j = s.dto.indexOf('[].');
      if (i < 0) { const v = at(obj as Json, s.raw); if (v === undefined) missing.add(prefix + s.dto); else put(out, s.dto, convert(s.f, v, policy)); continue; }
      ensure(j > 0); const id = `${s.raw.slice(0, i)}>${s.dto.slice(0, j)}`; const g = groups.get(id) ?? { key: s.raw.slice(0, i), dkey: s.dto.slice(0, j), specs: [] };
      g.specs.push({ raw: s.raw.slice(i + 3), dto: s.dto.slice(j + 3), f: s.f }); groups.set(id, g);
    }
    for (const g of groups.values()) {
      const v = at(obj as Json, g.key);
      if (v === undefined) { missing.add(`${prefix}${g.dkey}[]`); continue; }
      if (v === null) { put(out, g.dkey, null); continue; }
      ensure(Array.isArray(v) && v.length <= 2000); put(out, g.dkey, v.map(el => walk(g.specs, el, `${prefix}${g.dkey}[].`)));
    }
    return out;
  };
  const visible = fields.filter(f => f.type && (f.scope !== 'profile.pii' || pii));
  return { value: walk(visible.map(f => ({ raw: f.raw, dto: f.dto, f })), root, ''), missing: [...missing] };
}
// KMS articles are styled HTML: keep readable text only (block breaks, list bullets, common entities); the result is still untrusted data.
export function htmlToText(html: string) {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6]|tr|ul|ol)>/gi, '\n').replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
export function repeatedTotals(rows: Json[], fields: string[]) {
  const totals: Json = {};
  for (const key of fields) { const values = rows.map(r => Object.hasOwn(r, key) ? decimal(r[key]) : undefined); ensure(values.every(v => v === values[0])); if (values[0] !== undefined) totals[key] = values[0]; }
  return totals;
}
export function candles(raw: Json, from: number, to: number) {
  if (raw.s === 'no_data') { ensure(['t', 'o', 'h', 'l', 'c', 'v'].every(k => raw[k] === undefined || Array.isArray(raw[k]) && raw[k].length === 0)); return { items: [], nextTime: raw.nextTime ?? null }; }
  ensure(raw.s === 'ok' && ['t', 'o', 'h', 'l', 'c', 'v'].every(k => Array.isArray(raw[k]) && raw[k].length === raw.t.length));
  ensure(raw.t.length <= 366); let last = -Infinity;
  return { items: raw.t.map((t: unknown, i: number) => { ensure(typeof t === 'number' && Number.isSafeInteger(t) && t > last && t >= from && t <= to); last = t;
    return { time: t, open: decimal(String(raw.o[i])), high: decimal(String(raw.h[i])), low: decimal(String(raw.l[i])), close: decimal(String(raw.c[i])), volume: decimal(String(raw.v[i])) }; }) };
}
