import { route, validateInput } from './catalog.js';
import { Policy } from '../policy.js';
import type { Json } from '../store.js';
import { ensure } from '../errors.js';
export interface ReadRequest { operation: string; method: string; path: string; query: Json; body?: Json; accountNos: string[]; broker?: string }
export function buildRequest(id: string, raw: unknown, policy: Policy, page = 1): ReadRequest {
  const r = route(id); const i = validateInput(id, raw); const q: Json = {}; let body: Json | undefined;
  const needsBroker = r.requestBinding.startsWith('B='); const b = needsBroker ? policy.broker(i.brokerRef).brokerCode : undefined;
  const accounts = i.accountRef ? [policy.account(i.accountRef).accountNumber] : policy.accounts(i.accountRefs, b);
  const sub = i.subaccountRef ? policy.subaccount(i.subaccountRef, accounts.length === 1 ? accounts[0] : undefined).subId : undefined;
  const size = i.limit ?? 50; const ymd = (s: string) => s.replaceAll('-', ''); const dates = { fromDate: i.from && ymd(i.from), toDate: i.to && ymd(i.to) };
  ensure(Number.isInteger(page) && page >= 1 && page <= 10000, 'INVALID_INPUT');
  switch (id) {
    case 'identity.current': case 'accounts.tree': case 'market.catalog': break;
    case 'accounts.search': body = { accountNumbers: accounts, remNos: [b], fromBirthYear: i.birthYearFrom?.toString() ?? '', toBirthYear: i.birthYearTo?.toString() ?? '', searchKey: i.search ?? '', page, size }; break;
    case 'accounts.subaccounts': q.accountNos = accounts.join(','); break;
    case 'profile.detail': case 'profile.information': case 'profile.authorized': q.accountNo = accounts[0]; break;
    case 'customers.overview': Object.assign(q, { brokerCode: b, ...dates }); break;
    case 'assets.cash': case 'assets.stockValue': case 'assets.loanSummary': case 'assets.loanDetail': Object.assign(q, { accountNo: accounts[0], afAccountNo: sub }); break;
    case 'assets.margin': case 'portfolio.account': case 'orderSummary.account': Object.assign(q, { accountNo: accounts[0], afAccountNo: sub, subId: sub }); break;
    case 'brokerAssets.summary': case 'orderSummary.top': q.remNo = b; break;
    case 'brokerAssets.accounts': body = { brokerCode: b, accountNumbers: accounts, page, size }; break;
    case 'brokerAssets.cash': body = { remNo: b, accountNumbers: accounts, searchValue: i.search ?? '', page, size }; break;
    case 'brokerAssets.portfolio': body = { tlId: b, page, size }; break;
    case 'credit.guarantees': case 'credit.collateral': body = { brokerCode: b, accounts, subId: sub ?? null, page, size }; break;
    case 'loans.current': body = { remNo: b, accounts, loanStatus: i.loanStatus ?? ['0', '1', '2'], lndTp: null, mnId: null, fromLndDate: i.loanFrom ? ymd(i.loanFrom) : null, toLndDate: i.loanTo ? ymd(i.loanTo) : null, page, size }; break;
    case 'loans.history': body = { remNo: b, accounts, fromLndDate: ymd(i.from), toLndDate: ymd(i.to), page, size }; break;
    case 'loans.repayments': body = { remNo: b, accounts, page, size, fromLndDate: i.loanFrom ? ymd(i.loanFrom) : null, toLndDate: i.loanTo ? ymd(i.loanTo) : null,
      fromExpDate: i.expiryFrom ? ymd(i.expiryFrom) : null, toExpDate: i.expiryTo ? ymd(i.expiryTo) : null, fromRepayDate: i.repayFrom ? ymd(i.repayFrom) : null, toRepayDate: i.repayTo ? ymd(i.repayTo) : null,
      fromInitialDebt: null, toInitialDebt: null, fromAdjRepayAmt: null, toAdjRepayAmt: null, mnId: null, lndTp: null }; break;
    case 'orders.history': body = { brokerCodes: [b], accountNumbers: accounts, stockCodes: i.symbols ?? [], page, pageSize: size,
      ...(i.mode === 'today' ? { type: 0, ordStatus: ['0', '2', '1', '4', '3', '5', '6'] } : { fromDateTrades: ymd(i.from), toDateTrades: ymd(i.to), ordType: [], mdmType: [], ordStatus: [] }) }; break;
    case 'orders.unconfirmed': body = { ...dates, emNo: policy.session.identity.preferredUsername, page, pageSize: size }; break;
    case 'orderSummary.confirmations': q.remNo = policy.session.identity.preferredUsername; break;
    case 'orderSummary.transactions': Object.assign(q, { page, size }); body = { brokerCode: [b], accountNumbers: accounts, valueFilterInfo: {} }; break;
    case 'buyingPower.preview': body = { subNo: sub, stkCd: i.symbol, ordPri: i.price }; break;
    case 'cash.movements': body = { brokerCode: b, accounts: accounts.length ? accounts : null, ...dates, status: null, transTp: i.direction === 'deposit' ? '1' : i.direction === 'withdrawal' ? '2' : null, type: '[Perfomance] load deposit-withdrawal info', page, size }; break;
    case 'newAccounts.report': body = { brokerCode: b, fromActDate: ymd(i.from), toActDate: ymd(i.to), statAcc: null, custid: policy.subtree(b!), page, size }; break;
    case 'research.summary': body = { brokerCodes: [b] }; break;
    case 'research.list': body = { brokerCodes: [b], searchValue: i.search ?? '', tag: 'ALL' }; break;
    case 'groups.list': body = { brokerCodes: [b], accountNumbers: accounts, searchValue: i.search ?? '' }; break;
    case 'market.quote': body = { stk_cd: i.symbol }; break;
    case 'market.price': q.securities = i.symbol; break;
    case 'market.ticks': Object.assign(q, { symbol: i.symbol, fetchCount: size }); break;
    case 'market.candles': Object.assign(q, { symbol: i.symbol, resolution: '1D', from: Math.floor(Date.parse(i.fromTime) / 1000), to: Math.floor(Date.parse(i.toTime) / 1000) }); break;
    default: ensure(false, 'CAPABILITY_UNAVAILABLE');
  }
  return { operation: id, method: r.method, path: r.path, query: q, body, accountNos: accounts, broker: b };
}
