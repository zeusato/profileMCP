import test from 'node:test';
import assert from 'node:assert/strict';
import dictionary from '../config/sha-code-dictionary.json' with { type: 'json' };
import { codeDictionaryFor } from '../src/dictionary.js';
import { routes, isEnabled } from '../src/sha/catalog.js';

const field = (operation: string, path: string) => codeDictionaryFor(operation)!.fields.find(f => f.field === path)!;
const meaning = (operation: string, path: string, code: string) => field(operation, path).values.find(v => v.code === code);

test('DICT-01: operation-specific numeric/text codes and evidence limitations', () => {
  assert.equal(meaning('orders.history', 'items[].tradeStatus', '3')?.label, 'Đã hủy');
  assert.equal(meaning('orders.unconfirmed', 'items[].tradeStatus', 'N')?.label, 'Chưa xác nhận');
  assert.equal(meaning('orders.unconfirmed', 'items[].tradeStatus', '3'), undefined);
  assert.equal(meaning('orders.unconfirmed', 'items[].tradeStatus', 'Y'), undefined);
  assert.deepEqual(meaning('orders.history', 'items[].tradeStatus', '5'), { code: '5', label: 'Chờ duyệt', evidenceStatus: 'source-ui-unverified' });
  assert.equal(meaning('orders.history', 'items[].tradeStatus', '1')?.evidenceStatus, 'source-inferred');
  assert.match(field('orders.history', 'items[].tradeStatus').note, /chưa gặp mẫu/);
  assert.equal(meaning('cash.movements', 'items[].status', '1')?.label, 'Thành công');
  assert.equal(meaning('cash.movements', 'items[].transTp', '1')?.label, 'Nộp');
  assert.equal(meaning('profile.information', 'acntStat', 'S')?.label, 'Tạm ngưng');
  assert.equal(meaning('profile.information', 'ekycYn', 'N')?.label, 'Không');
  assert.equal(meaning('research.list', 'items[].status', 'CLOSED')?.label, 'Đã đóng');
  assert.equal(meaning('credit.collateral', 'items[].treatmentType', 'S'), undefined, 'source best-guess is not an accepted mapping');
});

test('DICT-02: unknowns, exact codes, source-label strings and bounded static metadata', () => {
  assert.deepEqual(field('loans.current', 'items[].loanStatus').values, []);
  assert.deepEqual(field('accounts.search', 'items[].accountStatus').values, [], 'do not borrow acntStat mapping');
  for (const code of ['05', '5 ', 'UNKNOWN', '']) assert.equal(meaning('orders.history', 'items[].tradeStatus', code), undefined);
  assert.equal(meaning('profile.information', 'acntStat', 'A - Hoạt động'), undefined);
  assert.match(field('profile.information', 'acntStat').sourceLabelFormat!, /Giữ cả chuỗi/);
  assert.equal(codeDictionaryFor('accounts.tree'), undefined);
  for (const r of routes) assert.ok(Buffer.byteLength(JSON.stringify(codeDictionaryFor(r.id) ?? {})) < 12000, r.id);
});

test('DICT-03: dictionary paths, source provenance and surveyed status coverage match catalog', () => {
  const keys = dictionary.entries.map(e => `${e.operation}/${e.field}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const entry of dictionary.entries) {
    const route = routes.find(r => r.id === entry.operation)!;
    const f = route.fieldMap.find(f => f.dto === entry.field);
    assert.ok(f, `${entry.operation}/${entry.field}`);
    assert.ok(!('scope' in f && f.scope === 'profile.pii'), 'static metadata cannot be populated from personal fields');
    assert.equal(new Set(entry.values.map(v => v.code)).size, entry.values.length);
    for (const v of entry.values) {
      assert.ok(Object.hasOwn(dictionary.evidenceLevels, v.evidenceStatus));
      assert.ok(v.label && entry.sourceRefs.length);
    }
    for (const ref of entry.sourceRefs) {
      const source = dictionary.sources[ref.source as keyof typeof dictionary.sources];
      assert.ok(source && Number.isSafeInteger(ref.line) && ref.line > 0);
      assert.match(source.sha256, /^[a-f0-9]{64}$/);
    }
  }
  // Candles consumes the upstream UDF `s` in a separate parser; it does not expose
  // catalog's draft data.status. RAW-market.candles tests that protocol flag.
  for (const r of routes.filter(r => isEnabled(r.id) && r.id !== 'market.candles')) for (const f of r.fieldMap) {
    if (/(status|acntStat|ekycYn|acptYn|smsYn)$/i.test(f.dto)) assert.ok(keys.includes(`${r.id}/${f.dto}`), `review missing for ${r.id}/${f.dto}`);
  }
});
