import test from 'node:test';
import assert from 'node:assert/strict';
import { routes, validateInput } from '../src/sha/catalog.js';
import { buildRequest } from '../src/sha/requests.js';
import { Vault } from '../src/crypto.js';
import { Policy } from '../src/policy.js';
import { decimal, project, pageCoverage, repeatedTotals, candles, type Field } from '../src/dto.js';
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
  assert.equal(decimal('0'), '0'); assert.equal(decimal(null), null); assert.throws(() => decimal('1.2.3'));
  // Live JSON carries fractional numbers (rates, prices): kept as shortest round-trip text; unsafe integers still rejected.
  assert.equal(decimal(1.23), '1.23'); assert.equal(decimal(0.07), '0.07'); assert.throws(() => decimal(2 ** 53 + 2)); assert.throws(() => decimal(Number.NaN));
  const fields = (id: string) => routes.find(r => r.id === id)!.fieldMap as Field[];
  const out = project(fields('assets.cash'), { cashTotal: '0', cashHold: null, rateCash: -1.5, secret: 'hidden' }, policy, false);
  assert.equal(out.value.cashTotal, '0'); assert.equal(out.value.cashHold, null); assert.equal(out.value.rateCash, '-1.5'); assert.equal(out.value.firstCashTotal, undefined); assert.equal(out.value.secret, undefined); assert.ok(out.missing.includes('firstCashTotal'));
  assert.throws(() => project(fields('assets.cash'), { cashTotal: 'abc' }, policy, false), /UPSTREAM_SHAPE_CHANGED/);
  // Customer personal data only with profile.pii; without it neither the value nor a missing marker leaks.
  const raw = { accountNo: 'A001', custNm: 'Synthetic Person', idNo: '012345678901', email: 'private@example.test', birthDt: '1990-01-02 00:00:00.0', grpTp: 'I', mobile_sms: '0355000000' };
  const plain = project(fields('profile.detail'), raw, policy, false);
  assert.deepEqual([plain.value.accountRef, plain.value.displayNumber, plain.value.grpTp], [accountRef, '***001', 'I']); assert.ok(!/Synthetic|012345678901|private@|1990|"A001"/.test(JSON.stringify(plain)));
  const full = project(fields('profile.detail'), raw, policy, true);
  assert.deepEqual([full.value.accountNumber, full.value.custNm, full.value.idNo, full.value.email, full.value.birthDt], ['A001', 'Synthetic Person', '012345678901', 'private@example.test', '1990-01-02 00:00:00.0']);
  // Live 10/10/2026 regression: phone/ID digit strings are identifiers, never decimals (leading zero kept).
  assert.equal(full.value.mobile_sms, '0355000000');
});
test('REQ-common: date ranges never span the 2026-05-22..24 core migration gap', () => {
  const base = { operation: 'cash.movements', brokerRef: 'b' };
  for (const [from, to] of [['2026-05-20', '2026-05-26'], ['2026-05-22', '2026-05-22'], ['2026-05-24', '2026-06-01']]) assert.throws(() => validateInput('cash.movements', { ...base, from, to }), /PERIOD_SPANS_DATA_GAP/);
  for (const [from, to] of [['2026-05-01', '2026-05-21'], ['2026-05-25', '2026-06-10']]) assert.doesNotThrow(() => validateInput('cash.movements', { ...base, from, to }));
  assert.throws(() => validateInput('loans.repayments', { operation: 'loans.repayments', repayFrom: '2026-05-21', repayTo: '2026-05-25' }), /PERIOD_SPANS_DATA_GAP/);
  assert.doesNotThrow(() => validateInput('market.candles', { operation: 'market.candles', symbol: 'FPT', resolution: '1D', fromTime: '2026-05-01T00:00:00Z', toTime: '2026-06-01T00:00:00Z' }));
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
