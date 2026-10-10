import test from 'node:test';
import assert from 'node:assert/strict';
import { ReadService } from '../src/service.js';
import { ShaTransport } from '../src/sha/transport.js';
import { SCOPES, PII_SCOPE } from '../src/config.js';
import { testStore, syntheticLogin } from './helpers.js';
// Synthetic fixtures shaped like the live 10/10/2026 responses (names/codes are fake).
const identity = [{ branchCode: 'BR1', brokerCode: 'B001', brokerName: 'BROKER CANARY', preferredUsername: 'SYNTHETIC', saleGroupName: 'G', saleGroupNo: '1', positionLevel: '1', homeOrder: '1', custodyCd: 'C' }];
const tree = () => ({
  accounts: [{ accountNumber: 'A001', customerName: 'CUSTOMER CANARY', brokerCode: 'B001', remNo: 'B001' }, { accountNumber: 'A002', customerName: null, brokerCode: 'B002', remNo: 'B002' }],
  brokers: [{ brokerCode: 'B001', brokerName: 'ROOT CANARY', level: '1', remNo: 'B001', remMng: null, accounts: null, children: [{ brokerCode: 'B002', brokerName: 'CHILD CANARY', level: '2', remNo: 'B002', remMng: 'B001', accounts: null, children: [] }] }],
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function harness(treeBody: unknown = { code: 200, message: 'ok', data: tree() }, scopes = SCOPES.filter(s => s !== PII_SCOPE)) {
  const { db, store, userId, settings } = await testStore(); const calls: string[] = [];
  const fetcher = (async (url: unknown) => { const path = new URL(String(url)).pathname; calls.push(path.split('/').pop()!); return path.endsWith('get-user-login') ? json({ code: 200, message: 'ok', data: identity }) : json(treeBody); }) as typeof fetch;
  const service = new ReadService(store, new ShaTransport(fetcher));
  const session = await store.createSession({ ...syntheticLogin(), userId, clientId: 'synthetic-client', grantId: 'grant-1', scopes, resource: settings.resource });
  const warn = console.warn; console.warn = () => {}; // silence sha.upstream diagnostics while the harness is open
  const call = (input: unknown, granted = scopes) => service.call('accounts.tree', input, session, granted, 'req-1');
  return { db, store, session, calls, call, close: async () => { console.warn = warn; await db.close(); } };
}
test('REQ-accounts.tree: strict input, accounts.read required, exactly identity + tree upstream', async () => {
  const h = await harness();
  try {
    await assert.rejects(h.call({ operation: 'accounts.tree', brokerCode: 'B001' }), /INVALID_INPUT/);
    await assert.rejects(h.call({ operation: 'accounts.tree' }, ['profile.read']), /FORBIDDEN_SCOPE/);
    assert.deepEqual(h.calls, [], 'rejected input or scope must not reach SHA');
    const result = await h.call({ operation: 'accounts.tree' }) as any;
    assert.equal(result.operation, 'accounts.tree'); assert.deepEqual(h.calls, ['get-user-login', 'account-no-and-rem']);
  } finally { await h.close(); }
});
test('RAW-accounts.tree: auth error revokes, shape and type drift fail closed', async () => {
  let h = await harness({ code: 401, message: 'x', data: null });
  try { await assert.rejects(h.call({ operation: 'accounts.tree' }), /UPSTREAM_AUTH_FAILED/); await assert.rejects(h.store.session(h.session.id), /REAUTH_REQUIRED/); } finally { await h.close(); }
  h = await harness({ code: 200, message: 'ok', data: { accounts: {}, brokers: [] } });
  try { await assert.rejects(h.call({ operation: 'accounts.tree' }), /UPSTREAM_SHAPE_CHANGED/); } finally { await h.close(); }
  const badName = tree(); (badName.accounts[0] as any).customerName = 42;
  h = await harness({ code: 200, message: 'ok', data: badName }, SCOPES);
  try { await assert.rejects(h.call({ operation: 'accounts.tree' }), /UPSTREAM_SHAPE_CHANGED/); } finally { await h.close(); }
});
test('DTO-accounts.tree: PII only with profile.pii; null and missing names preserved', async () => {
  let h = await harness();
  try {
    const result = await h.call({ operation: 'accounts.tree' }) as any; const text = JSON.stringify(result);
    assert.equal(result.data.accounts.length, 2); assert.equal(result.data.accounts[0].displayNumber, '***001'); assert.equal(result.data.accounts[1].brokerCode, 'B002');
    assert.ok(result.data.accounts.every((a: any) => !('accountNumber' in a) && !('customerName' in a) && /^acct_/.test(a.accountRef) && /^broker_/.test(a.brokerRef)));
    assert.ok(!/CANARY|"A001"|"A002"/.test(text), 'no names or full numbers without profile.pii');
    assert.deepEqual(result.data.brokers.map((b: any) => [b.brokerCode, b.directAccounts, b.children.length]), [['B002', 1, 0], ['B001', 1, 1]]);
  } finally { await h.close(); }
  const missingName = tree(); delete (missingName.accounts[1] as any).customerName;
  h = await harness({ code: 200, message: 'ok', data: missingName }, SCOPES);
  try {
    const result = await h.call({ operation: 'accounts.tree' }) as any;
    assert.deepEqual(result.data.accounts.map((a: any) => [a.accountNumber, a.customerName]), [['A001', 'CUSTOMER CANARY'], ['A002', null]]);
    assert.deepEqual(result.meta.fieldAvailability.missing, ['accounts[].customerName']); assert.ok(result.meta.warnings.includes('FIELDS_UNAVAILABLE'));
    assert.deepEqual(result.data.brokers.map((b: any) => b.brokerName).sort(), ['CHILD CANARY', 'ROOT CANARY']);
  } finally { await h.close(); }
  h = await harness({ code: 200, message: 'ok', data: tree() }, SCOPES);
  try { const result = await h.call({ operation: 'accounts.tree' }) as any; assert.equal(result.data.accounts[1].customerName, null); assert.deepEqual(result.meta.fieldAvailability.missing, []); } finally { await h.close(); }
});
test('SCOPE-accounts.tree: tree must hang from the identity broker; foreign accounts and session refs rejected', async () => {
  const foreignRoot = tree(); foreignRoot.brokers[0]!.brokerCode = 'B999'; foreignRoot.accounts[0]!.brokerCode = 'B999';
  let h = await harness({ code: 200, message: 'ok', data: foreignRoot });
  try { await assert.rejects(h.call({ operation: 'accounts.tree' }), /FORBIDDEN_SCOPE/); } finally { await h.close(); }
  const outside = tree(); outside.accounts[1]!.brokerCode = 'B777';
  h = await harness({ code: 200, message: 'ok', data: outside });
  try { await assert.rejects(h.call({ operation: 'accounts.tree' }), /FORBIDDEN_SCOPE/); } finally { await h.close(); }
  const a = await harness(); const b = await harness();
  try {
    const first = (await a.call({ operation: 'accounts.tree' }) as any).data.accounts[0].accountRef; const second = (await b.call({ operation: 'accounts.tree' }) as any).data.accounts[0].accountRef;
    assert.notEqual(first, second, 'references are bound to the session, not reusable across users/sessions');
  } finally { await a.close(); await b.close(); }
});
test('PAGE-accounts.tree: nonpaged full tree, output budget truncation is explicit', async () => {
  let h = await harness();
  try { const r = await h.call({ operation: 'accounts.tree' }) as any; assert.deepEqual([r.status, r.meta.coverage.complete, r.meta.coverage.total, r.meta.coverage.reason, r.meta.coverage.nextCursor], ['ok', true, 2, 'nonpaged-full-tree', null]); } finally { await h.close(); }
  const big = tree(); big.accounts = Array.from({ length: 401 }, (_, n) => ({ accountNumber: `A${String(n).padStart(4, '0')}`, customerName: `C${n}`, brokerCode: 'B001', remNo: 'B001' }));
  h = await harness({ code: 200, message: 'ok', data: big }, SCOPES);
  try {
    const r = await h.call({ operation: 'accounts.tree' }) as any;
    assert.deepEqual([r.status, r.data.accounts.length, r.meta.coverage.total, r.meta.coverage.truncated, r.meta.coverage.reason], ['partial', 400, 401, true, 'nonpaged-output-budget']);
    assert.ok(r.meta.warnings.includes('PARTIAL_PAGE')); assert.ok(Buffer.byteLength(JSON.stringify(r)) <= 128 * 1024);
  } finally { await h.close(); }
});
