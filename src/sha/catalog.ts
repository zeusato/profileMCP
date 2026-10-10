import catalog from '../../config/sha-read-candidates.json' with { type: 'json' };
import release from '../../config/runtime-release.json' with { type: 'json' };
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { AppError, ensure } from '../errors.js';
export const routes = catalog.routes;
export type Route = typeof routes[number];
const ajv = new Ajv({ allErrors: false, strict: false });
(addFormats as unknown as (a: Ajv) => void)(ajv);
const validators = new Map(routes.map(r => [r.id, ajv.compile(r.inputSchema)]));
export function route(id: string): Route { const r = routes.find(r => r.id === id); if (!r) throw new AppError('CAPABILITY_UNAVAILABLE'); return r; }
export function isEnabled(id: string): boolean { return (release.enabledOperations as string[]).includes(id); }
// SHA core migration 2026-05-22..24 has no data (Đại ca 10/10/2026): a business range may end by 05-21 or start from 05-25, never span it;
// callers query both sides and combine. Market data is served by another service and is not affected.
export const DATA_GAP = { from: '2026-05-22', to: '2026-05-24' };
export function validateInput(id: string, input: unknown): Record<string, any> {
  ensure(validators.get(id)?.(input), 'INVALID_INPUT'); const i = input as Record<string, any>;
  for (const [a, b, days] of [['from', 'to', 31], ['loanFrom', 'loanTo', 31], ['expiryFrom', 'expiryTo', 31], ['repayFrom', 'repayTo', 31], ['fromTime', 'toTime', 366]] as const) {
    ensure((i[a] === undefined) === (i[b] === undefined), 'INVALID_INPUT');
    if (i[a] !== undefined) {
      const start = Date.parse(i[a]); const end = Date.parse(i[b]);
      ensure(Number.isFinite(start) && Number.isFinite(end) && start <= end && end - start < days * 86400000, 'INVALID_INPUT');
      if (!a.endsWith('Time')) ensure(new Date(start).toISOString().slice(0, 10) === i[a] && new Date(end).toISOString().slice(0, 10) === i[b], 'INVALID_INPUT');
      if (!id.startsWith('market.') && String(i[a]).slice(0, 10) <= DATA_GAP.to && String(i[b]).slice(0, 10) >= DATA_GAP.from) throw new AppError('PERIOD_SPANS_DATA_GAP');
    }
  }
  ensure((i.birthYearFrom === undefined) === (i.birthYearTo === undefined), 'INVALID_INPUT');
  ensure(i.birthYearFrom === undefined || i.birthYearFrom <= i.birthYearTo, 'INVALID_INPUT');
  // Sub-account operations take subaccountRef or subNo (resolved server-side against the account's sub-accounts).
  if ((route(id).inputSchema as Record<string, unknown>)['x-subaccount']) ensure(i.subaccountRef || i.subNo, 'INVALID_INPUT');
  if (id === 'orders.history') ensure(i.mode === 'today' ? i.from === undefined && i.to === undefined : i.from !== undefined && i.to !== undefined, 'INVALID_INPUT');
  return i;
}
export function scopeFor(id: string): string {
  if (/^(identity|profile)\./.test(id)) return 'profile.read';
  if (id.startsWith('accounts.')) return 'accounts.read';
  if (/^(assets|portfolio|buyingPower)\./.test(id)) return 'assets.read';
  if (/^(orders|orderSummary)\./.test(id)) return 'orders.read';
  if (/^(credit|loans)\./.test(id)) return 'credit.read';
  if (id.startsWith('research.') || id.startsWith('knowledge.')) return 'research.read';
  if (id.startsWith('market.')) return 'market.read';
  return 'reports.read';
}
