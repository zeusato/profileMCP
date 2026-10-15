// Regenerates fieldMap entries of released operations from config/live-shapes-20261010.json (structure only) plus
// doc-only rows for operations whose live sample was empty. Rules: account numbers -> accountRef + masked displayNumber
// (+ full number under profile.pii); subaccount ids -> subaccountRef; customer personal data -> profile.pii; every numeric
// field keeps the source value as an exact decimal string with unit status unverified. Run: node scripts/gen-fieldmaps.mjs
import fs from 'node:fs';
const catalogPath = 'config/sha-read-candidates.json';
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const live = JSON.parse(fs.readFileSync('config/live-shapes-20261010.json', 'utf8'));
export const RELEASED = ['identity.current', 'accounts.tree', 'accounts.search', 'accounts.subaccounts', 'profile.detail', 'profile.information', 'customers.overview',
  'assets.cash', 'assets.stockValue', 'assets.margin', 'assets.loanSummary', 'portfolio.account', 'orderSummary.account', 'brokerAssets.summary', 'brokerAssets.accounts',
  'brokerAssets.cash', 'brokerAssets.portfolio', 'credit.guarantees', 'credit.collateral', 'loans.current', 'loans.history', 'loans.repayments', 'orders.history',
  'orderSummary.confirmations', 'cash.movements', 'newAccounts.report', 'research.summary', 'research.list', 'groups.list', 'market.catalog', 'market.quote',
  'market.price', 'market.ticks', 'market.candles',
  // Probe --extra 10/10/2026: list-confirm works with pageSize 30; order/balance computes buying power (no order); sum-transaction is same-day
  // totals (null outside trading); KMS knowledge library. profile.authorized (null x8) and orderSummary.top ([]) stay disabled.
  'orders.unconfirmed', 'buyingPower.preview', 'orderSummary.transactions', 'knowledge.departments', 'knowledge.documents'];
// Strapi-style KMS payloads: pagination lives in meta (reported in coverage); Photo.url is the cover; body media is derived separately from Content in knowledge.ts.
const OMIT = (id, raw) => id.startsWith('knowledge.') && (raw === 'meta' || /^data\[\]\.Photo\.(?!url$)/.test(raw));
// list-confirm sends prices/volumes as vi-VN formatted strings in dong (SHA_PC docs 6.2, confirmed 2026-07-02).
const TYPE_OVERRIDES = { 'orders.unconfirmed:orderPrice': ['vi-decimal', 'VND-localized-source (SHA_PC: dong, vi-VN)'], 'orders.unconfirmed:matchedPrice': ['vi-decimal', 'VND-localized-source (SHA_PC: dong, vi-VN)'],
  'orders.unconfirmed:orderVolume': ['vi-decimal', 'localized-quantity'], 'orders.unconfirmed:matchedVolume': ['vi-decimal', 'localized-quantity'],
  'knowledge.documents:Content': ['long-text', 'untrusted rich text (all readable text and body media references; cursor continuation)'] };
const ACCOUNT = new Set(['accountNo', 'accountNumber', 'acntNo']);
const SUBACCOUNT = new Set(['subId', 'afAccountNo']);
const PII = new Set(['customerName', 'custNm', 'identifierNumber', 'identity', 'identityDate', 'expiredDateId', 'identityIssuer', 'idNumberType', 'nationalityId', 'birthday',
  'sexId', 'telephone', 'email', 'address', 'registrationNo', 'registrationRep', 'registrationDate', 'idNo', 'idNoTp', 'issDt', 'issPlace', 'issExpired', 'birthDt', 'sexTp',
  'ctryCd', 'ctryNm', 'etcAddress', 'etcEmail', 'taxCd', 'telTp', 'mobile_sms', 'mobile', 'etc_mobile', 'frmNm', 'frmMobile', 'frmIdNo', 'frmIdNoTp', 'frmEmail', 'frmIssDt',
  'frmIssPlace', 'sidc', 'pcod', 'ctrNo', 'htsId', 'customerId', 'trfAcctNo', 'cnte', 'custodyCd']);
const PII_PATHS = new Set(['members[].name']);
const CODE = /(No|Cd|Code|Id|Tp|Type|Status|status|Stat|Level|Order|Grd|Brch|Bnh|Pth|Account)$|^(id|code|status|mb|s)$/;
const LIST_KEYS = new Set(['data', 'list', 'content']);
const IDENT_DIGITS = new Set(['brokerDpm']); // department code observed as a digit string
const PAGING = new Set(['page', 'size', 'totalElements', 'totalPages', 'pageNo', 'pageSize', 'totalCount', 'totalPage']); // reported in meta.coverage instead
// Units observed from live arithmetic on 10/10/2026 (still status unverified until checked against SHA screens).
const UNIT_OVERRIDES = { 'orders.history:orderValue': 'kVND-source (observed orderPrice x orderVolume)', 'orders.history:orderPrice': 'kVND-source (observed)', 'brokerAssets.portfolio:curPri': 'VND-source (observed evalAmtSum = ownQtySum x curPri)', 'brokerAssets.portfolio:costPri': 'VND-source (observed)', 'brokerAssets.portfolio:evalAmtSum': 'VND-source (observed)', 'portfolio.account:curPri': 'VND-source (observed evalAmt = ownQtyPl x curPri)', 'portfolio.account:costPri': 'VND-source (observed)', 'portfolio.account:evalAmt': 'VND-source (observed)', 'portfolio.account:bookAmtPl': 'VND-source (observed)', 'portfolio.account:evalPrf': 'VND-source (observed)', 'portfolio.account:ownQtyPl': 'security-units', 'portfolio.account:evalPer': 'percent (observed)', 'portfolio.account:stkPfRt': 'percent (observed)',
  'buyingPower.preview:buying_power': 'VND-source', 'buyingPower.preview:ppo': 'VND-source', 'buyingPower.preview:loan_total': 'VND-source', 'buyingPower.preview:gst_dpo': 'VND-source (SHA_PC: guarantee granted)',
  'buyingPower.preview:buy_abl_qty': 'security-units', 'buyingPower.preview:room_qty': 'security-units (margin room of the symbol)', 'buyingPower.preview:sell_able_qty': 'security-units' };
const MARKET_PRICE = /^(ceiling|floor|open|high|low|last|change|ref_price|avg_price|bid|offer|o|c|ch|h|l)$/;
const oldUnits = new Map(); for (const r of catalog.routes) for (const f of r.fieldMap) oldUnits.set(`${r.id}:${f.raw.split(/[.\]]/).filter(Boolean).pop()}`, f.unit);
// Rows for operations whose live sample was empty or null (SHA_PC docs/api/api-documentation.md @7261a8d, sha256 a3eec0f1…).
const DOC_ROWS = {
  // Live via connector 10/10/2026 (4 rows): doc keys acntNo/subNo/ownQty/outbillAbleQty/buyMthQty/sellMthQty absent; repeated totals bookAmtSum/evalAmtSum/evalSumPrf only in data.totals.
  'portfolio.account': ['stkCd', 'ownQtyPl', 'sellAbleQty', 'outqReqQty', 'rgtWaitQty', 'ppdSellMthQty', 'ppdBuyMthQty', 'pdSellMthQty', 'pdBuyMthQty', 'tdSellMthQty', 'tdBuyMthQty', 'curPri', 'costPri', 'bookAmtPl', 'evalAmt', 'evalPrf', 'evalPer', 'stkPfRt'],
  'credit.guarantees': ['brokerCode', 'accountNo', 'subNo', 'subId', 'customerName', 'afType', 'afName', 'blIssuedToday', 'minDeposit', 'safeRttSmDeposit', 'postAdvanceDeposit', 'adv1', 'advanceAmount', 'rtt', 'rttSm', 'cash', 'overdueCustodyFee', 'custodyFeeDebt', 'dayBuyMargin', 'matchedBuyMargin', 'pendingBuyMargin', 'convertedDebt', 'marginDebt', 'guaranteeDebt', 'accountLimit', 'outsidePortfolioMargin', 'advanceLine', 'expectedDebtRecovery', 'disburseSource', 'brokerId', 'brokerageDepartment', 'branchName'],
  'credit.collateral': ['accountNo', 'subId', 'subNo', 'customerName', 'accStatus', 'violationType', 'treatmentType', 'actualRatio', 'maintenanceRatio', 'liquidationRatio', 'convertedOutstandingDebt', 'collateralAssetValue', 'requiredAdditionalDeposit', 'guaranteedDebt', 'overdueDebt', 'requiredPaymentToExitCall', 'afType', 'maxForceSellAmt', 'remainForceSellAmt', 'forceSellAmtDueDebt', 'firstMarginCallDate', 'marginWarningDays', 'forceSellDays', 'brokerId', 'dpmtMng', 'brchMng'],
};
const DOC_TEXT = new Set(['stkCd', 'afType', 'afName', 'accStatus', 'violationType', 'treatmentType', 'brokerageDepartment', 'branchName', 'dpmtMng', 'brchMng', 'disburseSource']);
const DOC_DATE = new Set(['firstMarginCallDate']);
const DOC_OBJECT = { 'orderSummary.account': ['totalTransactionValue', 'revenueFee', 'stockExchangeFee', 'otherFees', 'buyTransactionValue', 'sellTransactionValue', 'depositoryFee', 'netTransactionFee'] };
function leaf(id, rawPath, dtoPath, kind, evidence, out) {
  const key = rawPath.split('.').pop().replace('[]', ''); const dtoBase = dtoPath.slice(0, dtoPath.length - key.length);
  const pii = PII.has(key) || PII_PATHS.has(rawPath.replace(/^items\[\]\./, ''));
  const base = { nullPolicy: 'null preserved; missing listed in fieldAvailability.missing', evidenceStatus: evidence };
  if (ACCOUNT.has(key)) {
    out.push({ raw: rawPath, dto: `${dtoBase}accountRef`, unit: 'opaque-reference', type: 'ref', ...base });
    out.push({ raw: rawPath, dto: `${dtoBase}displayNumber`, unit: 'masked-number', type: 'masked', ...base });
    out.push({ raw: rawPath, dto: `${dtoBase}accountNumber`, unit: 'identifier', type: 'string', scope: 'profile.pii', ...base });
    return;
  }
  if (SUBACCOUNT.has(key)) { out.push({ raw: rawPath, dto: `${dtoBase}subaccountRef`, unit: 'opaque-reference', type: 'ref', ...base }); return; }
  let type; let unit;
  if (kind === 'boolean') { type = 'boolean'; unit = 'boolean'; }
  // sum-transaction totals are null outside trading hours but are amounts/counts (SHA_PC docs 14.8).
  else if (kind === 'null' && id === 'orderSummary.transactions') { type = 'decimal'; unit = key === 'sumAccounts' ? 'count' : 'VND-source (same-day)'; }
  else if (kind === 'null') { type = 'any'; unit = 'null-in-live-sample'; }
  // Numeric identifiers (KMS id, codes) stay identifiers, rendered as strings.
  else if (/^number/.test(kind) && CODE.test(key)) { type = 'string'; unit = 'identifier'; }
  else if (/datetime|dd\/mm|yyyy-mm-dd/.test(kind)) { type = 'string'; unit = 'source-datetime-unverified-zone'; }
  else if (kind === 'string:vi-number') { type = 'vi-decimal'; unit = 'number-source-unverified'; }
  // Personal identifiers and phone numbers are digit strings, never amounts: keep them verbatim (leading zeros).
  else if (/^number/.test(kind) || kind === 'string:decimal-dot' || (kind === 'string:int' && !CODE.test(key) && !pii && !IDENT_DIGITS.has(key))) { type = 'decimal'; unit = oldUnits.get(`${id}:${key}`) ?? 'number-source-unverified'; if (unit === 'unverified' || unit === 'restricted') unit = 'number-source-unverified'; }
  else { type = 'string'; unit = CODE.test(key) || kind === 'string:int' ? 'identifier' : 'text'; }
  if (type === 'decimal') unit = UNIT_OVERRIDES[`${id}:${key}`] ?? (id.startsWith('market.') && MARKET_PRICE.test(key) ? 'VND-source (observed FPT 57900)' : unit);
  if (TYPE_OVERRIDES[`${id}:${key}`]) [type, unit] = TYPE_OVERRIDES[`${id}:${key}`];
  out.push({ raw: rawPath, dto: dtoPath, unit, type, ...(pii ? { scope: 'profile.pii' } : {}), ...base });
}
function walk(id, shape, rawPrefix, dtoPrefix, evidence, out, omitted) {
  for (const [key, kind] of Object.entries(shape)) {
    if (!rawPrefix && PAGING.has(key)) continue;
    const raw = `${rawPrefix}${key}`;
    if (OMIT(id, raw)) { omitted.push(raw); continue; }
    if (kind && typeof kind === 'object' && 'items' in kind) {
      if (kind.of && typeof kind.of === 'object') walk(id, kind.of, `${raw}[].`, `${dtoPrefix}${!rawPrefix && LIST_KEYS.has(key) ? 'items' : key}[].`, evidence, out, omitted);
      else omitted.push(raw);
    } else if (kind && typeof kind === 'object') walk(id, kind, `${raw}.`, `${dtoPrefix}${key}.`, evidence, out, omitted);
    else leaf(id, raw, `${dtoPrefix}${key}`, kind, evidence, out);
  }
}
// First successful sample per operation (list-confirm's first probe was a 400).
const shapes = new Map(); for (const s of live.shapes) if (!shapes.has(s.operation) && s.httpStatus === 200) shapes.set(s.operation, s);
for (const r of catalog.routes) {
  const released = RELEASED.includes(r.id); r.enabled = released; r.status = released ? 'released' : 'planned-candidate';
  if (!released || ['accounts.tree', 'market.candles'].includes(r.id)) continue;
  const s = shapes.get(r.id); const out = []; const omitted = []; let evidence = 'live-shape-2026-10-10';
  const data = s?.data;
  if (r.id === 'identity.current') walk(r.id, data.of, 'items[].', 'items[].', evidence, out, omitted);
  else if (DOC_ROWS[r.id]) {
    evidence = r.id === 'portfolio.account' ? 'live-connector-2026-10-10' : 'doc-only-live-sample-empty';
    if (data && typeof data === 'object' && !('items' in data)) walk(r.id, Object.fromEntries(Object.entries(data).filter(([k]) => !LIST_KEYS.has(k))), '', '', 'live-shape-2026-10-10', out, omitted);
    const rows = Object.fromEntries(DOC_ROWS[r.id].map(k => [k, DOC_DATE.has(k) ? 'string:datetime' : DOC_TEXT.has(k) || CODE.test(k) || ACCOUNT.has(k) || SUBACCOUNT.has(k) || PII.has(k) ? 'string' : 'number:int']));
    walk(r.id, rows, r.id === 'portfolio.account' ? 'items[].' : 'data[].', 'items[].', evidence, out, omitted);
  } else if (DOC_OBJECT[r.id]) { evidence = 'doc-only-live-sample-null'; walk(r.id, Object.fromEntries(DOC_OBJECT[r.id].map(k => [k, 'number:int'])), '', '', evidence, out, omitted); }
  else if (data && typeof data === 'object' && 'items' in data) walk(r.id, data.of, 'items[].', 'items[].', evidence, out, omitted);
  else walk(r.id, data, '', '', evidence, out, omitted);
  // list-confirm rejects pageSize 5 (live 10/10/2026); the builder always asks 30 per page, so no client limit.
  if (r.id === 'orders.unconfirmed') delete r.inputSchema.properties.limit;
  if (r.id === 'market.catalog') r.inputSchema = { type: 'object', additionalProperties: false, properties: { operation: { const: 'market.catalog' }, search: { type: 'string', minLength: 1, maxLength: 50 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, required: ['operation', 'search'] };
  // Sub-account operations also accept subNo ("00", "01"...) resolved server-side, so a client without accounts.subaccounts refs can still ask.
  const props = r.inputSchema.properties; const required = r.inputSchema.required ?? [];
  if (props.subaccountRef) { props.subNo = { type: 'string', pattern: '^[0-9]{2}$' }; if (required.includes('subaccountRef') || r.inputSchema['x-subaccount']) { r.inputSchema.required = required.filter(k => k !== 'subaccountRef'); r.inputSchema['x-subaccount'] = 'subaccountRef-or-subNo'; } }
  r.fieldMap = out;
  r.rawResponse = `${s ? `live 2026-10-10: ${s.method} HTTP ${s.httpStatus}, envelope ${JSON.stringify(s.envelope)}` : 'no live sample'}; mapped ${out.length} fields${omitted.length ? `; omitted (shape unknown or recipient lists): ${omitted.join(', ')}` : ''}`;
}
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
const releasePath = 'config/runtime-release.json'; const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
release.enabledOperations = RELEASED; fs.writeFileSync(releasePath, JSON.stringify(release, null, 2) + '\n');
console.log(JSON.stringify(catalog.routes.filter(r => r.enabled).map(r => [r.id, r.fieldMap.length, r.fieldMap.filter(f => f.scope === 'profile.pii').length])));
