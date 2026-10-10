import { AppError, ensure } from './errors.js';
import { Policy, parseEntitlements, parseIdentity, type Entitlements } from './policy.js';
import { Store, type Json, type Session } from './store.js';
import { isEnabled, route, scopeFor, validateInput } from './sha/catalog.js';
import { ShaTransport } from './sha/transport.js';
import { buildRequest } from './sha/requests.js';
import { candles, htmlToText, pageCoverage, project, repeatedTotals, type Field } from './dto.js';
import { PII_SCOPE } from './config.js';
const TREE_MAX_ACCOUNTS = 400;
const CONTENT_MAX = 4000;
// The row list of a wrapper response is the first array segment of the fieldMap (data[] / list[] / content[]).
const listKeyOf = (fields: Field[]) => fields.find(f => /^(data|list|content)\[\]\./.test(f.raw))?.raw.split('[]')[0];
const PERIODS = [['from', 'to'], ['repayFrom', 'repayTo'], ['loanFrom', 'loanTo'], ['expiryFrom', 'expiryTo'], ['fromTime', 'toTime']] as const;
const period = (i: Json) => { const pair = PERIODS.find(([a]) => i[a] !== undefined); return pair ? { field: pair[0], from: i[pair[0]], to: i[pair[1]] } : null; };
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
    // An upstream 401 during bootstrap means the SHA session is gone: revoke like a failed read.
    const upstream = async <T>(call: () => Promise<T>) => { try { return await call(); } catch (error) { if (error instanceof AppError && error.code === 'UPSTREAM_AUTH_FAILED') await this.store.revoke(session); throw error; } };
    const identityRaw = await upstream(() => this.sha.bootstrap('identity.current', session.bearer, signal)) as Json;
    const identity = parseIdentity(identityRaw, session.identity.preferredUsername);
    const tree = await upstream(() => this.sha.bootstrap('accounts.tree', session.bearer, signal)) as Json;
    const entitlements = parseEntitlements(tree, identity);
    const p = new Policy({ ...session, identity }, this.store.vault, entitlements);
    const accountRef = i.accountRef ?? (i.accountRefs?.length === 1 ? i.accountRefs[0] : undefined);
    if ((i.subaccountRef || i.subNo) && accountRef) {
      const account = p.account(accountRef); const raw = await this.sha.read(buildRequest('accounts.subaccounts', { operation: 'accounts.subaccounts', accountRefs: [accountRef] }, p), session.bearer, signal);
      entitlements.subaccounts = this.subaccounts(raw, p, [account.accountNumber]);
      // subNo ("00", "01"...) is the display number; it resolves to the internal subId of that account only.
      if (i.subNo) { const s = entitlements.subaccounts.find(x => x.accountNo === account.accountNumber && x.subNo === i.subNo); ensure(s, 'FORBIDDEN_SCOPE'); i.subaccountRef = p.ref('sub', s.subId); }
    }
    ensure(!i.subNo || i.subaccountRef, 'INVALID_INPUT');
    // The department path segment must be one of the live KMS departments, not just a well-formed token.
    if (id === 'knowledge.documents') {
      const deps = await this.sha.read(buildRequest('knowledge.departments', { operation: 'knowledge.departments' }, p), session.bearer, signal) as Json;
      ensure(Array.isArray(deps?.data) && deps.data.some((d: Json) => d?.Code === i.department), 'FORBIDDEN_SCOPE');
    }
    const filter = { ...i }; delete filter.cursor; const filterDigest = this.store.vault.digest(JSON.stringify(filter));
    let cursor: Json | undefined;
    if (i.cursor) {
      cursor = await this.store.get('Cursor', i.cursor);
      ensure(cursor && cursor.sessionId === session.id && cursor.userId === session.userId && cursor.teamId === session.teamId && cursor.generation === session.generation && cursor.operation === id && cursor.filterDigest === filterDigest, 'FORBIDDEN_SCOPE');
    }
    const request = buildRequest(id, i, p, cursor?.page ?? 1);
    try {
      // Bootstrap responses are reused for identity/tree (already fetched and validated above); no second upstream call.
      const raw = id === 'accounts.tree' ? tree : id === 'identity.current' ? identityRaw : await this.sha.read(request, session.bearer, signal) as Json;
      const fetchedAt = new Date().toISOString(); const pii = scopes.includes(PII_SCOPE); const fields = r.fieldMap as Field[];
      if (id !== 'accounts.tree') p.checkResponse(raw, request.accountNos, request.broker);
      let data: Json | null; let coverage: Json = { returned: 1, total: null, complete: true, nextCursor: null, truncated: false, reason: 'single-record-contract', pagesFetched: 1, totalsScope: 'unknown' };
      const warnings = new Set(['SOURCE_TIMESTAMP_UNAVAILABLE', 'UNIT_UNVERIFIED', 'NON_ATOMIC_SNAPSHOT']); const missing: string[] = [];
      if (!fields.some(f => f.type ? /decimal/.test(f.type) : /VND|count|units|decimal|unverified/.test(f.unit))) warnings.delete('UNIT_UNVERIFIED');
      if (id === 'accounts.tree') {
        const t = this.tree(tree, p, pii); data = t.data; missing.push(...t.missing);
        coverage = { returned: t.data.accounts.length, total: t.total, complete: !t.truncated, nextCursor: null, truncated: t.truncated, reason: t.truncated ? 'nonpaged-output-budget' : 'nonpaged-full-tree', pagesFetched: 1, totalsScope: 'all-entitled-accounts' };
        if (t.truncated) warnings.add('PARTIAL_PAGE');
      } else if (id === 'market.candles') { data = candles(raw, request.query.from, request.query.to); coverage.returned = data.items.length; }
      else if (raw === null) {
        // Source null (e.g. no orders, no summary) is not an empty list: say so instead of inventing zeros.
        data = null; coverage = { returned: 0, total: null, complete: false, nextCursor: null, truncated: false, reason: 'source-null', pagesFetched: 1, totalsScope: 'unknown' }; warnings.add('SOURCE_NULL');
      } else {
        if (id === 'accounts.subaccounts') this.subaccounts(raw, p, request.accountNos);
        const variant = raw && typeof raw === 'object' && !Array.isArray(raw) ? ('totalElements' in raw ? 'page' : 'totalCount' in raw ? 'orders' : raw.meta?.pagination ? 'cms' : null) : null;
        let root: unknown = raw;
        // Strict page checks only when this request sent paging (a per-sub-account credit query sends none and gets SHA defaults back).
        const sentPaging = request.body?.page !== undefined || request.query.page !== undefined;
        // The page size actually sent (list-confirm always asks 30; others the client limit).
        const pageSize = Number(request.body?.size ?? request.body?.pageSize ?? request.query.size ?? request.query.pageSize ?? i.limit ?? 50);
        const listKey = listKeyOf(fields);
        const nullCounters = variant === 'page' ? raw.totalElements === null : variant === 'orders' ? raw.totalCount === null : false;
        if (variant === 'cms') {
          // KMS (Strapi) pagination: meta.pagination {page, pageSize, pageCount, total}.
          const pg = raw.meta.pagination; ensure(Array.isArray(raw.data) && [pg.page, pg.pageSize, pg.pageCount, pg.total].every(Number.isSafeInteger) && raw.data.length <= pg.pageSize);
          coverage = { returned: raw.data.length, total: pg.total, complete: pg.page >= pg.pageCount, nextCursor: null, truncated: false, reason: pg.page >= pg.pageCount ? 'single-page' : 'partial-page', pagesFetched: 1, totalsScope: 'unknown' };
          if (pg.page < pg.pageCount) {
            const next = this.store.vault.nonce(); await this.store.put('Cursor', next, { sessionId: session.id, userId: session.userId, teamId: session.teamId, generation: session.generation, operation: id, filterDigest, page: pg.page + 1, total: pg.total, fingerprint: this.store.vault.digest(JSON.stringify(raw.data)) }, 300);
            coverage.nextCursor = next; warnings.add('PARTIAL_PAGE');
          }
        } else if (variant && nullCounters) {
          // sum-transaction outside trading: counters and totals null; nothing to page through.
          ensure(raw[listKey ?? 'data'] === null || Array.isArray(raw[listKey ?? 'data']));
          coverage = { returned: raw[listKey ?? 'data']?.length ?? 0, total: null, complete: false, nextCursor: null, truncated: false, reason: 'source-counters-null', pagesFetched: 1, totalsScope: 'unknown' }; warnings.add('SOURCE_NULL');
        } else if (variant && !sentPaging) {
          ensure(Array.isArray(raw[listKey ?? 'data'])); const rows = raw[listKey ?? 'data'];
          coverage = { ...coverage, returned: rows.length, total: rows.length, reason: 'single-scope-query' };
        } else if (variant) {
          ensure(Array.isArray(raw[listKey ?? 'data'])); const rows = raw[listKey ?? 'data'];
          coverage = pageCoverage(raw, rows, cursor?.page ?? 1, pageSize, variant);
          const fingerprint = this.store.vault.digest(JSON.stringify(rows));
          if (cursor) ensure(cursor.total === coverage.total && cursor.fingerprint !== fingerprint);
          if ((cursor?.page ?? 1) * pageSize < coverage.total) {
            const next = this.store.vault.nonce(); await this.store.put('Cursor', next, { sessionId: session.id, userId: session.userId, teamId: session.teamId, generation: session.generation, operation: id, filterDigest, page: (cursor?.page ?? 1) + 1, total: coverage.total, fingerprint }, 300);
            coverage.nextCursor = next; warnings.add('PARTIAL_PAGE');
          }
        } else if (!Array.isArray(raw)) {
          if (listKey && Array.isArray(raw[listKey])) coverage = { ...coverage, returned: raw[listKey].length, total: raw[listKey].length, reason: 'nonpaged-complete' };
        } else if (Array.isArray(raw)) {
          ensure(raw.length <= 20000); let rows: Json[] = raw;
          if (id === 'market.catalog') {
            const q = String(i.search).toUpperCase(); const rank = (x: Json) => String(x?.shortName ?? '').toUpperCase() === q ? 0 : String(x?.shortName ?? '').toUpperCase().startsWith(q) ? 1 : 2;
            rows = raw.filter(x => rank(x) < 2 || String(x?.name ?? '').toUpperCase().includes(q)).sort((a, b) => rank(a) - rank(b));
          }
          const max = i.limit ?? (id === 'market.catalog' ? 50 : 100);
          coverage = { returned: Math.min(rows.length, max), total: rows.length, complete: rows.length <= max, nextCursor: null, truncated: rows.length > max, reason: rows.length > max ? 'nonpaged-output-budget' : 'nonpaged-complete', pagesFetched: 1, totalsScope: 'unknown' };
          if (rows.length > max) warnings.add('PARTIAL_PAGE');
          root = { items: rows.slice(0, max) };
        }
        const projected = project(fields, root, p, pii); data = projected.value; missing.push(...projected.missing);
        // Portfolio totals repeat on every row: return one copy only after checking they agree.
        if (id === 'portfolio.account' && Array.isArray(raw) && raw.length) data.totals = repeatedTotals(raw, ['bookAmtSum', 'evalAmtSum', 'evalSumPrf']);
        // Live 10/10/2026: loan-info/history returned loans whose lndDate lies outside fromLndDate/toLndDate; flag instead of claiming the filter.
        // KMS content is untrusted rich text and can be long: cap per item, flagged.
        if (id === 'knowledge.documents' && Array.isArray(data?.items)) for (const it of data.items) if (typeof it.Content === 'string') {
          const text = htmlToText(it.Content); it.Content = text.slice(0, CONTENT_MAX); it.contentFormat = 'text-from-html';
          if (text.length > CONTENT_MAX) { it.contentTruncated = true; warnings.add('CONTENT_TRUNCATED'); }
        }
        if (id === 'loans.history' && !Array.isArray(raw) && Array.isArray(raw?.data) && (raw.data as Json[]).some((x: Json) => typeof x?.lndDate === 'string' && (x.lndDate.slice(0, 10) < i.from || x.lndDate.slice(0, 10) > i.to))) warnings.add('PERIOD_FILTER_UNVERIFIED');
      }
      if (missing.length) warnings.add('FIELDS_UNAVAILABLE');
      const result = { schemaVersion: '1', operation: id, status: coverage.complete ? 'ok' : 'partial', data, meta: { provider: 'SHA', sourceOperation: id, fetchedAt,
        sourceTimestamp: null, businessDate: null, scope: { accountRef: i.accountRef, subaccountRef: i.subaccountRef, brokerRef: i.brokerRef }, requestedPeriod: period(i),
        units: Object.fromEntries((r.fieldMap as Field[]).filter(f => (f.type ? /decimal/.test(f.type) : f.unit !== 'restricted') && (f.scope !== PII_SCOPE || pii)).map(f => [f.dto, { unit: f.unit, status: 'unverified' }])), coverage, fieldAvailability: { missing }, warnings: [...warnings], requestId } };
      ensure(Buffer.byteLength(JSON.stringify(result)) <= 128 * 1024, 'UPSTREAM_SHAPE_CHANGED');
      await this.store.fence(session); return result;
    } catch (error) { if (error instanceof AppError && error.code === 'UPSTREAM_AUTH_FAILED') await this.store.revoke(session); throw error; }
  }
  // Refs, masked number, broker codes and staff (broker) names always; full account number and customer name only with profile.pii.
  // Live shape 10/10/2026: accounts{accountNumber,customerName,brokerCode,remNo}, brokers{brokerCode,brokerName,level,remNo,remMng,children,accounts}.
  private tree(raw: Json, p: Policy, pii: boolean) {
    const names = new Map<string, unknown>(raw.accounts.map((a: Json) => [a.accountNumber, a.customerName]));
    const brokerNames = new Map<string, unknown>(); const walk = (rows: Json[]) => rows.forEach(b => { brokerNames.set(b.brokerCode, b.brokerName); walk(b.children); }); walk(raw.brokers);
    const text = (v: unknown) => { if (v === undefined || v === null) return null; ensure(typeof v === 'string' && v.length <= 300); return v; };
    const all = p.entitlements.accounts; const shown = all.slice(0, TREE_MAX_ACCOUNTS); const missing: string[] = [];
    if (pii && shown.some(a => names.get(a.accountNumber) === undefined)) missing.push('accounts[].customerName');
    if (p.entitlements.brokers.some(b => brokerNames.get(b.brokerCode) === undefined)) missing.push('brokers[].brokerName');
    const accounts = shown.map(a => ({ accountRef: p.ref('acct', a.accountNumber), displayNumber: `***${a.accountNumber.slice(-3)}`, brokerRef: p.ref('broker', a.brokerCode), brokerCode: a.brokerCode,
      ...(pii ? { accountNumber: a.accountNumber, customerName: text(names.get(a.accountNumber)) } : {}) }));
    const brokers = p.entitlements.brokers.map(b => ({ brokerRef: p.ref('broker', b.brokerCode), brokerCode: b.brokerCode, brokerName: text(brokerNames.get(b.brokerCode)),
      children: b.children.map(x => p.ref('broker', x)), directAccounts: all.filter(a => a.brokerCode === b.brokerCode).length }));
    return { data: { accounts, brokers }, total: all.length, truncated: all.length > shown.length, missing };
  }
  private subaccounts(raw: unknown, policy: Policy, accounts: string[]): Entitlements['subaccounts'] {
    ensure(Array.isArray(raw)); const seen = new Set<string>(); return raw.flatMap(row => {
      ensure(row && accounts.includes(row.accountNo) && Array.isArray(row.subAccounts), 'FORBIDDEN_SCOPE');
      return row.subAccounts.map((s: Json) => { ensure(typeof s.subId === 'string' && typeof s.subNo === 'string' && !seen.has(s.subId)); seen.add(s.subId); return { accountNo: row.accountNo, subId: s.subId, subNo: s.subNo }; });
    });
  }
}
