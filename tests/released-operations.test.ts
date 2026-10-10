import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ReadService } from '../src/service.js';
import { ShaTransport } from '../src/sha/transport.js';
import { routes, isEnabled, scopeFor } from '../src/sha/catalog.js';
import { SCOPES, PII_SCOPE } from '../src/config.js';
import type { Field } from '../src/dto.js';
import { testStore, syntheticLogin } from './helpers.js';
// Table-driven REQ/RAW/DTO/SCOPE/PAGE suites for every released operation that uses the generic fieldMap projection.
// Fixtures are synthetic, generated from each fieldMap (itself generated from the 10/10/2026 live shapes); no network.
const live = JSON.parse(readFileSync('config/live-shapes-20261010.json', 'utf8')) as { shapes: { operation: string; data: any }[] };
const pagedBy = (id: string) => { const d = live.shapes.find(s => s.operation === id)?.data; return d && typeof d === 'object' ? ('totalElements' in d ? 'page' : 'totalCount' in d ? 'orders' : null) : null; };
const ACCOUNT = /^(accountNo|accountNumber|acntNo)$/; const SUB = /^(subId|afAccountNo)$/;
const IDENTITY = [{ preferredUsername: 'SYNTHETIC', brokerCode: 'B001', branchCode: 'BR1', brokerName: 'STAFF', saleGroupName: 'G', saleGroupNo: '1', positionLevel: 'D', homeOrder: '1', custodyCd: 'CUSTODY CANARY' }];
const TREE = { accounts: [{ accountNumber: 'A001', customerName: 'CUSTOMER CANARY', brokerCode: 'B001', remNo: 'B001' }], brokers: [{ brokerCode: 'B001', brokerName: 'STAFF', children: [] }] };
const SUBS = [{ accountNo: 'A001', subAccounts: [{ subNo: '00', subId: 'INTERNAL001', subTp: '1', subName: 'Normal' }] }];
const put = (o: any, path: string, v: unknown) => { const k = path.split('.'); let x = o; for (const p of k.slice(0, -1)) x = x[p] ??= {}; x[k.at(-1)!] = v; };
function value(f: Field) {
  const key = f.raw.split('.').pop()!;
  if (ACCOUNT.test(key)) return 'A001'; if (SUB.test(key)) return 'INTERNAL001'; if (key === 'brokerCode') return 'B001'; if (key === 'preferredUsername') return 'SYNTHETIC';
  if (f.type === 'decimal') return '12.5'; if (f.type === 'vi-decimal') return '1.234,5'; if (f.type === 'boolean') return true; if (f.type === 'any') return null;
  return f.scope === PII_SCOPE ? 'CUSTOMER CANARY' : /datetime/.test(f.unit) ? '2026-10-01 09:00:00.0' : 'X1';
}
function build(paths: [string, unknown][]): any {
  const out = {}; const groups = new Map<string, [string, unknown][]>();
  for (const [p, v] of paths) { const i = p.indexOf('[].'); if (i < 0) put(out, p, v); else { const k = p.slice(0, i); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push([p.slice(i + 3), v]); } }
  for (const [k, g] of groups) put(out, k, [build(g)]);
  return out;
}
function fixture(id: string, fields: Field[], limit: number) {
  const unique = new Map<string, unknown>(); for (const f of fields) if (!unique.has(f.raw)) unique.set(f.raw, value(f));
  const built = build([...unique]); let raw: any = fields.some(f => f.raw.startsWith('items[].')) ? built.items : built;
  const variant = pagedBy(id);
  if (variant) {
    const listKey = fields.find(f => /^(data|list|content)\[\]\./.test(f.raw))?.raw.split('[]')[0] ?? 'data'; raw[listKey] ??= [];
    const n = raw[listKey].length; Object.assign(raw, variant === 'page' ? { page: 1, size: limit, totalElements: n, totalPages: n ? 1 : 0 } : { pageNo: 1, pageSize: limit, totalCount: n, totalPage: n ? 1 : 0 });
  }
  return raw;
}
const INPUT: Record<string, (r: Refs) => Record<string, unknown>> = {
  'identity.current': () => ({}), 'accounts.search': r => ({ brokerRef: r.broker, limit: 5 }), 'accounts.subaccounts': r => ({ accountRefs: [r.account] }),
  'profile.detail': r => ({ accountRef: r.account }), 'profile.information': r => ({ accountRef: r.account }), 'customers.overview': r => ({ brokerRef: r.broker, from: '2026-09-11', to: '2026-10-10' }),
  'brokerAssets.summary': r => ({ brokerRef: r.broker }), 'orderSummary.confirmations': () => ({}), 'research.summary': r => ({ brokerRef: r.broker }), 'research.list': r => ({ brokerRef: r.broker }),
  'groups.list': r => ({ brokerRef: r.broker }), 'market.catalog': () => ({ search: 'X1' }), 'market.quote': () => ({ symbol: 'FPT' }), 'market.price': () => ({ symbol: 'FPT' }), 'market.ticks': () => ({ symbol: 'FPT', limit: 5 }),
  'loans.history': r => ({ brokerRef: r.broker, from: '2026-09-11', to: '2026-10-10', limit: 5 }), 'loans.repayments': r => ({ brokerRef: r.broker, repayFrom: '2026-09-11', repayTo: '2026-10-10', limit: 5 }),
  'orders.history': r => ({ brokerRef: r.broker, mode: 'history', from: '2026-09-11', to: '2026-10-10', limit: 5 }), 'cash.movements': r => ({ brokerRef: r.broker, from: '2026-09-11', to: '2026-10-10', limit: 5 }),
  'newAccounts.report': r => ({ brokerRef: r.broker, from: '2026-09-11', to: '2026-10-10', limit: 5 }),
  'orders.unconfirmed': () => ({ from: '2026-10-04', to: '2026-10-10' }), 'buyingPower.preview': r => ({ accountRef: r.account, subaccountRef: r.sub, symbol: 'FPT', price: '57900' }),
  'orderSummary.transactions': r => ({ brokerRef: r.broker, limit: 5 }), 'knowledge.departments': () => ({}), 'knowledge.documents': () => ({ department: 'X1', limit: 5 }),
};
const SIZE: Record<string, number> = { 'orders.unconfirmed': 30 }; // page size the builder sends
const DEPARTMENTS = { data: [{ id: 1, documentId: 'd1', Name: 'Dept', Code: 'X1', Order: 1 }], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } } };
for (const id of ['assets.cash', 'assets.stockValue', 'assets.margin', 'assets.loanSummary', 'portfolio.account', 'orderSummary.account']) INPUT[id] = r => ({ accountRef: r.account, subaccountRef: r.sub });
for (const id of ['brokerAssets.accounts', 'brokerAssets.cash', 'brokerAssets.portfolio', 'credit.guarantees', 'credit.collateral', 'loans.current']) INPUT[id] = r => ({ brokerRef: r.broker, limit: 5 });
interface Refs { account: string; broker: string; sub: string }
const released = routes.filter(r => isEnabled(r.id) && !['accounts.tree', 'market.candles'].includes(r.id));
test('every released generic operation has a test input and live-shaped fieldMap', () => {
  assert.deepEqual(released.filter(r => !INPUT[r.id] || !(r.fieldMap as Field[]).every(f => f.type)).map(r => r.id), []);
  assert.ok(released.length >= 30);
});
async function harness() {
  const { db, store, userId, settings } = await testStore(); store.quota = async () => {}; // read quotas are covered by DB-02/03
  const fixtures = new Map<string, () => Response>(); const calls: string[] = []; const bodies = new Map<string, any>(); let resolving = false;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetcher = (async (url: unknown, init?: RequestInit) => {
    const path = new URL(String(url)).pathname; const key = `${init?.method ?? 'GET'} ${path}`; calls.push(key);
    if (init?.body) bodies.set(key, JSON.parse(String(init.body)));
    const custom = !resolving && fixtures.get(key); if (custom) return custom();
    if (path.endsWith('get-user-login')) return json({ code: 200, message: 'ok', data: IDENTITY });
    if (path.endsWith('account-no-and-rem')) return json({ code: 200, message: 'ok', data: TREE });
    if (path.endsWith('list-sub-no')) return json({ code: 200, message: 'ok', data: SUBS });
    if (path.endsWith('forward/cms/departments')) return json(DEPARTMENTS);
    return json({ code: 404, message: 'unexpected route', data: null });
  }) as typeof fetch;
  const service = new ReadService(store, new ShaTransport(fetcher)); const warn = console.warn; console.warn = () => {};
  // References are bound to the session (id, generation, user, team): each new session resolves its own refs through the released tools.
  const fresh = async (op: string) => {
    const session = await store.createSession({ ...syntheticLogin(), userId, clientId: 'synthetic-client', grantId: `grant-${Math.random()}`, scopes: SCOPES, resource: settings.resource });
    resolving = true;
    try {
      const tree = await service.call('accounts.tree', { operation: 'accounts.tree' }, session, SCOPES, 'r') as any;
      const subs = await service.call('accounts.subaccounts', { operation: 'accounts.subaccounts', accountRefs: [tree.data.accounts[0].accountRef] }, session, SCOPES, 'r') as any;
      const refs: Refs = { account: tree.data.accounts[0].accountRef, broker: tree.data.brokers[0].brokerRef, sub: subs.data.items[0].subAccounts[0].subaccountRef };
      return { session, input: { operation: op, ...INPUT[op]!(refs) } };
    } finally { resolving = false; }
  };
  const call = async (op: string, scopes = SCOPES, extra: Record<string, unknown> = {}) => { const f = await fresh(op); calls.length = 0; return { result: await service.call(op, { ...f.input, ...extra }, f.session, scopes, 'r') as any, session: f.session }; };
  const fails = async (op: string, pattern: RegExp, scopes = SCOPES, extra: Record<string, unknown> = {}) => { const f = await fresh(op); await assert.rejects(service.call(op, { ...f.input, ...extra }, f.session, scopes, 'r'), pattern); return f.session; };
  return { store, service, fixtures, calls, json, call, fails, fresh, bodies, close: async () => { console.warn = warn; await db.close(); } };
}
for (const r of released) {
  const fields = r.fieldMap as Field[]; const key = `${r.method} ${r.path.replace('{department}', 'X1')}`; const pii = fields.some(f => f.scope === PII_SCOPE); const size = SIZE[r.id] ?? 5;
  const accountField = fields.find(f => ACCOUNT.test(f.raw.split('.').pop()!));
  test(`REQ/RAW/DTO/SCOPE/PAGE-${r.id}`, async () => {
    const h = await harness();
    try {
      const raw = fixture(r.id, fields, size); const respond = (data: unknown) => () => h.json({ code: 200, message: 'ok', data });
      if (r.id !== 'identity.current') h.fixtures.set(key, respond(raw));
      // REQ: strict input, scope per operation, the exact catalog method/path called once.
      await h.fails(r.id, /INVALID_INPUT/, SCOPES, { unexpected: 1 }); await h.fails(r.id, /FORBIDDEN_SCOPE/, SCOPES.filter(s => s !== scopeFor(r.id)));
      const plain = await h.call(r.id, SCOPES.filter(s => s !== PII_SCOPE));
      if (r.id !== 'identity.current') assert.equal(h.calls.filter(c => c === key).length, 1, h.calls.join(' | '));
      // DTO: allowlisted projection; no customer PII without profile.pii; every mapped field present with it.
      assert.equal(plain.result.operation, r.id); assert.ok(!/CUSTOMER CANARY|CUSTODY CANARY|"A001"/.test(JSON.stringify(plain.result)), JSON.stringify(plain.result).slice(0, 400));
      const full = (await h.call(r.id)).result;
      assert.deepEqual(full.meta.fieldAvailability.missing, [], `${r.id} fixture should cover every mapped field`); assert.equal(full.status, 'ok');
      if (pii) assert.ok(/CUSTOMER CANARY|CUSTODY CANARY|"A001"/.test(JSON.stringify(full.data)));
      if (fields.some(f => f.type === 'decimal')) assert.ok(full.meta.warnings.includes('UNIT_UNVERIFIED') && Object.values(full.meta.units).every((u: any) => u.status === 'unverified'));
      // PAGE: paged wrappers report coverage from upstream counters.
      if (pagedBy(r.id)) assert.equal(full.meta.coverage.total, (raw.data ?? raw.list ?? raw.content).length);
      if (r.id === 'identity.current') return;
      // RAW: an envelope auth error revokes the session; a non-numeric amount is a shape error, not a zero.
      h.fixtures.set(key, () => h.json({ code: 401, message: 'x', data: null }));
      const revoked = await h.fails(r.id, /UPSTREAM_AUTH_FAILED/); await assert.rejects(h.store.session(revoked.id), /REAUTH_REQUIRED/);
      const decimalField = fields.find(f => f.type === 'decimal');
      if (decimalField) { h.fixtures.set(key, respond(fixture(r.id, fields.map(f => f.raw === decimalField.raw ? { ...f, type: 'string', scope: undefined, unit: 'text' } : f), size))); await h.fails(r.id, /UPSTREAM_SHAPE_CHANGED/); }
      // SCOPE: an account outside the entitlement tree anywhere in the response fails closed.
      if (accountField) { h.fixtures.set(key, respond(JSON.parse(JSON.stringify(raw).replaceAll('"A001"', '"Z999"')))); await h.fails(r.id, /FORBIDDEN_SCOPE/); }
      // Source null is reported, not turned into zeros or an empty list.
      h.fixtures.set(key, respond(null)); const nulled = (await h.call(r.id)).result;
      assert.deepEqual([nulled.data, nulled.status, nulled.meta.warnings.includes('SOURCE_NULL')], [null, 'partial', true]);
    } finally { await h.close(); }
  });
}

test('live 10/10/2026 regressions: subNo, credit bodies, periods, list coverage, loan period flag', async () => {
  const h = await harness(); const ok = (data: unknown) => () => h.json({ code: 200, message: 'ok', data });
  try {
    // subNo resolves to that account's internal subId; unknown subNo is out of scope; one of subaccountRef/subNo is required.
    h.fixtures.set('GET /prod/v2/sha-service/e/asset/money-information', ok({ accountNo: 'A001', subNo: '00', subId: 'INTERNAL001', cashTotal: '5' }));
    let f = await h.fresh('assets.cash'); const { subaccountRef, ...byAccount } = f.input as any;
    const bySubNo = await h.service.call('assets.cash', { ...byAccount, subNo: '00' }, f.session, SCOPES, 'r') as any;
    assert.equal(bySubNo.data.cashTotal, '5'); assert.equal(bySubNo.data.subaccountRef, subaccountRef);
    f = await h.fresh('assets.cash'); await assert.rejects(h.service.call('assets.cash', { ...(({ subaccountRef: _, ...x }) => x)(f.input as any), subNo: '99' }, f.session, SCOPES, 'r'), /FORBIDDEN_SCOPE/);
    f = await h.fresh('assets.cash'); await assert.rejects(h.service.call('assets.cash', (({ subaccountRef: _, ...x }) => x)(f.input as any), f.session, SCOPES, 'r'), /INVALID_INPUT/);
    // credit.*: broker list sends {brokerCode, page, size}; a sub-account query sends {brokerCode, accounts, subId}.
    const credit = 'POST /prod/v2/sha-service/e/asset/guarantee-information-list';
    h.fixtures.set(credit, ok({ page: 1, size: 5, totalElements: 0, totalPages: 0, data: [] }));
    await h.call('credit.guarantees'); assert.deepEqual(h.bodies.get(credit), { brokerCode: 'B001', page: 1, size: 5 });
    f = await h.fresh('credit.guarantees'); const one = { operation: 'credit.guarantees', accountRefs: [((await h.fresh("assets.cash")).input as any).accountRef] };
    await assert.rejects(h.service.call('credit.guarantees', one, f.session, SCOPES, 'r'), /FORBIDDEN_SCOPE|INVALID_INPUT/);
    const g = await h.fresh('assets.cash'); await h.service.call('credit.guarantees', { operation: 'credit.guarantees', accountRefs: [(g.input as any).accountRef], subNo: '00' }, g.session, SCOPES, 'r');
    assert.deepEqual(h.bodies.get(credit), { brokerCode: 'B001', accounts: ['A001'], subId: 'INTERNAL001' });
    // requestedPeriod names the period field actually used.
    h.fixtures.set('POST /prod/v2/sha-service/e/asset/debt-info/history', ok({ page: 1, size: 5, totalElements: 0, totalPages: 0, data: [] }));
    assert.deepEqual((await h.call('loans.repayments')).result.meta.requestedPeriod, { field: 'repayFrom', from: '2026-09-11', to: '2026-10-10' });
    // Object roots with a nested list count the list rows.
    h.fixtures.set('GET /prod/v2/sha-system/e/trading/stock-quote-list', ok({ lastIndex: 1, lastSize: 3, data: [{ c: '1' }, { c: '2' }, { c: '3' }] }));
    assert.equal((await h.call('market.ticks')).result.meta.coverage.returned, 3);
    // loans.history rows outside from/to are flagged, not silently accepted as in-period.
    h.fixtures.set('POST /prod/v2/sha-service/e/asset/loan-info/history', ok({ page: 1, size: 5, totalElements: 1, totalPages: 1, data: [{ accountNo: 'A001', lndDate: '2026-05-26 00:00:00' }] }));
    assert.ok((await h.call('loans.history')).result.meta.warnings.includes('PERIOD_FILTER_UNVERIFIED'));
    // KMS: meta.pagination drives the cursor; departments outside the live list are refused; long content is capped and flagged.
    const docs = 'GET /prod/v2/sha-service/e/forward/cms/knowledge-shares/department/X1';
    h.fixtures.set(docs, () => h.json({ data: [{ id: 7, Title: 'T', Content: '<p style="font-family:x !important">' + 'x'.repeat(5000) + '</p>' }, { id: 8, Title: 'U', Content: '<ul><li style="a:b"><b>Nhận định</b> &amp; báo cáo</li></ul><style>p{}</style>' }], meta: { pagination: { page: 1, pageSize: 5, pageCount: 3, total: 11 } } }));
    const kms = (await h.call('knowledge.documents')).result;
    assert.deepEqual([kms.meta.coverage.total, kms.meta.coverage.complete, typeof kms.meta.coverage.nextCursor, kms.data.items[0].Content.length, kms.data.items[0].contentTruncated, kms.data.items[0].id], [11, false, 'string', 4000, true, '7']);
    assert.ok(kms.meta.warnings.includes('CONTENT_TRUNCATED') && kms.meta.warnings.includes('PARTIAL_PAGE'));
    // Styled HTML becomes readable text before the cap (styles and tags dropped, entities decoded).
    assert.deepEqual([kms.data.items[1].Content, kms.data.items[1].contentFormat, kms.data.items[1].contentTruncated], ['- Nhận định & báo cáo', 'text-from-html', undefined]);
    await h.fails('knowledge.documents', /FORBIDDEN_SCOPE/, SCOPES, { department: 'ZZ' });
    // list-confirm always asks 30 rows per page.
    h.fixtures.set('POST /prod/v2/sha-service/e/order/list-confirm', ok({ pageNo: 1, pageSize: 30, totalCount: 0, totalPage: 0, content: [] }));
    await h.call('orders.unconfirmed'); assert.equal(h.bodies.get('POST /prod/v2/sha-service/e/order/list-confirm').pageSize, 30);
    // sum-transaction outside trading: null counters are reported, not a shape error.
    h.fixtures.set('POST /prod/v2/sha-service/e/order/sum-transaction', ok({ page: 1, size: 5, totalElements: null, totalPages: null, sumTranValue: null, data: [] }));
    const sums = (await h.call('orderSummary.transactions')).result; assert.deepEqual([sums.data.sumTranValue, sums.meta.warnings.includes('SOURCE_NULL')], [null, true]);
  } finally { await h.close(); }
});
