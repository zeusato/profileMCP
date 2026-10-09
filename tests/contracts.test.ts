import test from 'node:test';
import assert from 'node:assert/strict';
import { routes, validateInput } from '../src/sha/catalog.js';
import { buildRequest } from '../src/sha/requests.js';
import { Vault } from '../src/crypto.js';
import { Policy } from '../src/policy.js';
import { decimal, mappedObject, pageCoverage, repeatedTotals, candles } from '../src/dto.js';
import { syntheticLogin, syntheticEntitlements } from './helpers.js';
const vault = new Vault({ active: 'k', keys: { k: Buffer.alloc(32, 4).toString('base64url') } }, Buffer.alloc(32, 5).toString('base64url'));
const session = { ...syntheticLogin(), id: 's', userId: 'u', teamId: 't', generation: 1, clientId: 'c', grantId: 'g', scopes: [], resource: 'r' };
const policy = new Policy(session, vault, syntheticEntitlements);
const accountRef = policy.ref('acct', 'A001'), subaccountRef = policy.ref('sub', 'INTERNAL001');
test('REQ-A/B: exact account/subId binding; GET and POST loan-info remain distinct', () => {
  const cash = buildRequest('assets.cash', { operation: 'assets.cash', accountRef, subaccountRef }, policy);
  assert.equal(cash.path, '/prod/v2/sha-service/e/asset/money-information'); assert.deepEqual(cash.query, { accountNo: 'A001', afAccountNo: 'INTERNAL001' }); assert.equal(cash.body, undefined);
  const margin = buildRequest('assets.margin', { operation: 'assets.margin', accountRef, subaccountRef }, policy); assert.equal(margin.query.subId, 'INTERNAL001');
  const loan = buildRequest('assets.loanDetail', { operation: 'assets.loanDetail', accountRef, subaccountRef }, policy); assert.equal(loan.method, 'GET');
  assert.equal(routes.find(r => r.id === 'loans.current')?.method, 'POST');
  assert.throws(() => buildRequest('assets.cash', { operation: 'assets.cash', accountRef, subaccountRef, brokerCode: 'forged' }, policy), /INVALID_INPUT/);
});
test('REQ-orders: today has no dates; username and broker bindings differ', () => {
  const today = buildRequest('orders.history', { operation: 'orders.history', mode: 'today' }, policy);
  assert.equal(today.body?.type, 0); assert.equal(today.body?.fromDateTrades, undefined); assert.deepEqual(today.body?.brokerCodes, ['B001']);
  const history = buildRequest('orders.history', { operation: 'orders.history', mode: 'history', from: '2026-10-01', to: '2026-10-09' }, policy);
  assert.equal(history.body?.fromDateTrades, '20261001'); assert.equal(history.body?.type, undefined);
  assert.equal(buildRequest('orderSummary.confirmations', { operation: 'orderSummary.confirmations' }, policy).query.remNo, 'SYNTHETIC');
});
test('REQ-common: strict schemas reject transport injection, invalid dates and inverted ranges', () => {
  for (const r of routes) assert.throws(() => validateInput(r.id, { operation: r.id, url: 'https://evil.example', method: 'POST', headers: {} }), /INVALID_INPUT/);
  for (const dates of [{ from: '2026-02-30', to: '2026-03-01' }, { from: '2026-10-10', to: '2026-10-09' }, { from: '2026-01-01', to: '2026-10-09' }])
    assert.throws(() => validateInput('customers.overview', { operation: 'customers.overview', ...dates }), /INVALID_INPUT/);
});
test('DTO: numeric precision, locale, negative, zero/null/missing and PII allowlist', () => {
  assert.equal(decimal('9007199254740993999.1234'), '9007199254740993999.1234'); assert.equal(decimal('-1.234.567,50', 'vi'), '-1234567.5');
  assert.equal(decimal('0'), '0'); assert.equal(decimal(null), null); assert.throws(() => decimal('1.2.3')); assert.throws(() => decimal(1.23));
  const r = routes.find(r => r.id === 'assets.cash')!; const out = mappedObject(r, { cashTotal: '0', cashHold: null, secret: 'hidden' }, policy);
  assert.equal(out.value.cashTotal, '0'); assert.equal(out.value.cashHold, null); assert.equal(out.value.firstCashTotal, undefined); assert.equal(out.value.secret, undefined); assert.ok(out.missing.includes('firstCashTotal'));
  const profile = mappedObject(routes.find(r => r.id === 'profile.detail')!, { accountNo: 'A001', custNm: 'Synthetic Person', idNo: 'SECRET', email: 'private@example.test' }, policy);
  assert.equal(profile.value.accountRef, accountRef); assert.equal(profile.value.customerDisplay, 'S***'); assert.equal(profile.value.email, undefined); assert.equal(profile.value.identityDocument, undefined);
});
test('PAGE / DTO-portfolio: no repeated-total double counting or completeness inflation', () => {
  assert.deepEqual(repeatedTotals([{ total: '10' }, { total: '10' }], ['total']), { total: '10' });
  assert.throws(() => repeatedTotals([{ total: '10' }, { total: '11' }], ['total']));
  const page = pageCoverage({ page: 1, size: 2, totalElements: 3, totalPages: 2 }, [{}, {}], 1, 2, 'page'); assert.equal(page.complete, false);
  assert.throws(() => pageCoverage({ page: 2, size: 2, totalElements: 3, totalPages: 2 }, [{}, {}], 2, 2, 'page'));
});
test('RAW-market.candles: flat UDF shape, no_data, chronological timestamps and range', () => {
  const r = { s: 'ok', t: [100, 200], o: [1, 2], h: [2, 3], l: [1, 1], c: [2, 2], v: [100, 200] };
  assert.equal(candles(r, 100, 200).items.length, 2); assert.throws(() => candles({ ...r, t: [200, 100] }, 100, 200));
  assert.throws(() => candles({ ...r, c: [1] }, 100, 200)); assert.deepEqual(candles({ s: 'no_data' }, 100, 200), { items: [], nextTime: null });
});
