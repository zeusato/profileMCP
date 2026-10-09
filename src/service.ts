import { AppError, ensure } from './errors.js';
import { Policy, parseEntitlements, parseIdentity, type Entitlements } from './policy.js';
import { Store, type Json, type Session } from './store.js';
import { isEnabled, route, scopeFor, validateInput } from './sha/catalog.js';
import { ShaTransport } from './sha/transport.js';
import { buildRequest } from './sha/requests.js';
import { candles, mappedObject, pageCoverage, repeatedTotals } from './dto.js';
export class ReadService {
  constructor(readonly store: Store, readonly sha: ShaTransport) {}
  async call(id: string, input: unknown, session: Session, scopes: string[], requestId: string) {
    const release = await this.store.acquire(session);
    try { return await this.execute(id, input, session, scopes, requestId); } finally { await release(); }
  }
  private async execute(id: string, input: unknown, session: Session, scopes: string[], requestId: string) {
    ensure(isEnabled(id), 'CAPABILITY_UNAVAILABLE'); ensure(scopes.includes(scopeFor(id)), 'FORBIDDEN_SCOPE');
    const i = validateInput(id, input); const r = route(id); const signal = AbortSignal.timeout(20000);
    await this.store.fence(session); await this.store.quota(`read:${session.userId}`, 30); await this.store.quota('read-project', 120);
    const identity = parseIdentity(await this.sha.bootstrap('identity.current', session.bearer, signal), session.identity.preferredUsername);
    const entitlements = parseEntitlements(await this.sha.bootstrap('accounts.tree', session.bearer, signal) as Json, identity);
    const p = new Policy({ ...session, identity }, this.store.vault, entitlements);
    if (i.subaccountRef) {
      const account = p.account(i.accountRef); const raw = await this.sha.read(buildRequest('accounts.subaccounts', { operation: 'accounts.subaccounts', accountRefs: [i.accountRef] }, p), session.bearer, signal);
      entitlements.subaccounts = this.subaccounts(raw, p, [account.accountNumber]);
    }
    const filter = { ...i }; delete filter.cursor; const filterDigest = this.store.vault.digest(JSON.stringify(filter));
    let cursor: Json | undefined;
    if (i.cursor) {
      cursor = await this.store.get('Cursor', i.cursor);
      ensure(cursor && cursor.sessionId === session.id && cursor.userId === session.userId && cursor.teamId === session.teamId && cursor.generation === session.generation && cursor.operation === id && cursor.filterDigest === filterDigest, 'FORBIDDEN_SCOPE');
    }
    const request = buildRequest(id, i, p, cursor?.page ?? 1);
    try {
      const raw = await this.sha.read(request, session.bearer, signal) as Json;
      const fetchedAt = new Date().toISOString();
      p.checkResponse(raw, request.accountNos, request.broker);
      let data: Json; let coverage: Json = { returned: 1, total: null, complete: true, nextCursor: null, truncated: false, reason: 'single-record-contract', pagesFetched: 1, totalsScope: 'unknown' };
      const warnings = new Set(['SOURCE_TIMESTAMP_UNAVAILABLE', 'UNIT_UNVERIFIED', 'NON_ATOMIC_SNAPSHOT']); const missing: string[] = [];
      if (id === 'accounts.tree') data = this.references(p);
      else if (id === 'accounts.subaccounts') {
        const subs = this.subaccounts(raw, p, request.accountNos);
        data = { items: subs.map(s => ({ accountRef: p.ref('acct', s.accountNo), subaccountRef: p.ref('sub', s.subId), displayNumber: s.subNo })) }; coverage.returned = subs.length;
      } else if (id === 'market.candles') { data = candles(raw, request.query.from, request.query.to); coverage.returned = data.items.length; }
      else if (/page wrapper|data \{page/.test(r.rawResponse)) {
        ensure(raw && !Array.isArray(raw)); const listKey = id.startsWith('orders.') ? 'content' : id === 'brokerAssets.accounts' || id === 'brokerAssets.cash' ? 'list' : 'data';
        ensure(Array.isArray(raw[listKey])); const rows = raw[listKey];
        coverage = pageCoverage(raw, rows, cursor?.page ?? 1, i.limit ?? 50, id.startsWith('orders.') ? 'orders' : 'page');
        const fingerprint = this.store.vault.digest(JSON.stringify(rows));
        if (cursor) ensure(cursor.total === coverage.total && cursor.fingerprint !== fingerprint);
        const root = mappedObject(r, raw, p); const mapped = rows.map((row: Json) => mappedObject(r, row, p, `${listKey}[].`).value);
        data = { ...root.value, items: mapped };
        if ((cursor?.page ?? 1) * (i.limit ?? 50) < coverage.total) {
          const next = this.store.vault.nonce(); await this.store.put('Cursor', next, { sessionId: session.id, userId: session.userId, teamId: session.teamId, generation: session.generation, operation: id, filterDigest, page: (cursor?.page ?? 1) + 1, total: coverage.total, fingerprint }, 300);
          coverage.nextCursor = next; warnings.add('PARTIAL_PAGE');
        }
      } else if (Array.isArray(raw)) {
        ensure(raw.length <= 1000); const all = raw.map(row => mappedObject(r, row, p)); const max = i.limit ?? 100;
        data = { items: all.slice(0, max).map(x => x.value) }; coverage.returned = data.items.length;
        if (raw.length > max) { coverage.complete = false; coverage.truncated = true; coverage.reason = 'nonpaged-output-budget'; warnings.add('PARTIAL_PAGE'); }
        if (id === 'portfolio.account') { data.totals = repeatedTotals(raw, ['bookAmtSum', 'evalAmtSum', 'evalSumPrf']); }
      } else {
        ensure(!['profile.authorized', 'orderSummary.top', 'market.price'].includes(id), 'CAPABILITY_UNAVAILABLE');
        const mapped = mappedObject(r, raw, p); data = mapped.value; missing.push(...mapped.missing);
      }
      if (missing.length) warnings.add('FIELDS_UNAVAILABLE');
      const result = { schemaVersion: '1', operation: id, status: coverage.complete ? 'ok' : 'partial', data, meta: { provider: 'SHA', sourceOperation: id, fetchedAt,
        sourceTimestamp: null, businessDate: null, scope: { accountRef: i.accountRef, subaccountRef: i.subaccountRef, brokerRef: i.brokerRef }, requestedPeriod: i.from ? { from: i.from, to: i.to } : null,
        units: Object.fromEntries(r.fieldMap.filter(f => f.unit !== 'restricted').map(f => [f.dto, { unit: f.unit, status: 'unverified' }])), coverage, fieldAvailability: { missing }, warnings: [...warnings], requestId } };
      ensure(Buffer.byteLength(JSON.stringify(result)) <= 128 * 1024, 'UPSTREAM_SHAPE_CHANGED');
      await this.store.fence(session); return result;
    } catch (error) { if (error instanceof AppError && error.code === 'UPSTREAM_AUTH_FAILED') await this.store.revoke(session); throw error; }
  }
  private references(p: Policy) { return { accounts: p.entitlements.accounts.map(a => ({ accountRef: p.ref('acct', a.accountNumber), displayNumber: `***${a.accountNumber.slice(-3)}`, brokerRef: p.ref('broker', a.brokerCode) })), brokers: p.entitlements.brokers.map(b => ({ brokerRef: p.ref('broker', b.brokerCode), children: b.children.map(x => p.ref('broker', x)) })) }; }
  private subaccounts(raw: unknown, policy: Policy, accounts: string[]): Entitlements['subaccounts'] {
    ensure(Array.isArray(raw)); const seen = new Set<string>(); return raw.flatMap(row => {
      ensure(row && accounts.includes(row.accountNo) && Array.isArray(row.subAccounts), 'FORBIDDEN_SCOPE');
      return row.subAccounts.map((s: Json) => { ensure(typeof s.subId === 'string' && typeof s.subNo === 'string' && !seen.has(s.subId)); seen.add(s.subId); return { accountNo: row.accountNo, subId: s.subId, subNo: s.subNo }; });
    });
  }
}
