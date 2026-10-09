import { Decimal } from 'decimal.js';
import type { Json } from './store.js';
import { ensure } from './errors.js';
import type { Route } from './sha/catalog.js';
import type { Policy } from './policy.js';
export function decimal(value: unknown, locale: 'dot' | 'vi' = 'dot'): string | null {
  if (value === null) return null;
  ensure(typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value)));
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
export function mappedObject(r: Route, raw: Json, policy: Policy, stripPrefix = '') {
  ensure(raw && typeof raw === 'object' && !Array.isArray(raw)); const out: Json = {}; const missing: string[] = [];
  for (const field of r.fieldMap) {
    if (field.unit === 'restricted' || /nested-mapped|tree/.test(field.unit)) continue;
    let path = field.raw;
    if (stripPrefix && path.startsWith(stripPrefix)) path = path.slice(stripPrefix.length);
    if (path.includes('[]')) continue;
    const dest = field.dto.replace(/^(items|data|list|content)\[\]\./, '');
    if (dest.includes('[]')) continue;
    const v = at(raw, path); if (v === undefined) { missing.push(dest); continue; }
    if (v === null) { put(out, dest, null); continue; }
    let value: unknown = v;
    if (field.unit === 'opaque-reference') {
      ensure(typeof v === 'string'); value = policy.ref(/subaccount/i.test(dest) ? 'sub' : /broker/i.test(dest) ? 'broker' : 'acct', v);
    } else if (field.unit === 'masked-text') { ensure(typeof v === 'string'); value = v.length ? `${v.slice(0, 1)}***` : ''; }
    else if (/VND|security-units|count|decimal/.test(field.unit)) value = decimal(v, /formatted|vi-VN/.test(field.unit) ? 'vi' : 'dot');
    else { ensure(['string', 'number', 'boolean'].includes(typeof v)); ensure(typeof v !== 'string' || v.length <= 2000); }
    put(out, dest, value);
  }
  return { value: out, missing };
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
