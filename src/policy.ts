import { ensure } from './errors.js';
import type { Json, Session } from './store.js';
import { Vault } from './crypto.js';
export interface Entitlements { accounts: { accountNumber: string; brokerCode: string }[]; brokers: { brokerCode: string; children: string[] }[]; subaccounts: { accountNo: string; subId: string; subNo: string }[] }
const identifier = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(x);
export function parseIdentity(raw: unknown, username: string): Json {
  ensure(Array.isArray(raw) && raw.length > 0 && raw.length <= 30);
  // SHA IDs are case-insensitive: login-v2 echoes the typed case, get-user-login returns the canonical preferredUsername (live 10/10/2026).
  const canonical = raw[0]?.preferredUsername; ensure(identifier(canonical) && canonical.toLowerCase() === username.toLowerCase());
  ensure(raw.every(r => r && r.preferredUsername === canonical && identifier(r.brokerCode)));
  return { preferredUsername: canonical, brokerCodes: [...new Set(raw.map(r => r.brokerCode))], rows: raw.map(r => ({ preferredUsername: r.preferredUsername, brokerCode: r.brokerCode, branchCode: r.branchCode })) };
}
export function parseEntitlements(raw: Json, identity: Json): Entitlements {
  ensure(raw && Array.isArray(raw.accounts) && Array.isArray(raw.brokers) && raw.accounts.length <= 10000 && raw.brokers.length <= 1000);
  const brokers: Entitlements['brokers'] = []; const seen = new Set<string>();
  const walk = (rows: Json[], depth: number): string[] => {
    ensure(depth <= 10); return rows.map(b => {
      ensure(identifier(b.brokerCode) && !seen.has(b.brokerCode)); seen.add(b.brokerCode);
      ensure(Array.isArray(b.children)); const children = walk(b.children, depth + 1);
      brokers.push({ brokerCode: b.brokerCode, children }); return b.brokerCode;
    });
  };
  const roots = walk(raw.brokers, 0);
  ensure(roots.length > 0 && roots.every(root => identity.brokerCodes.includes(root)), 'FORBIDDEN_SCOPE');
  const accounts: Entitlements['accounts'] = []; const seenAccounts = new Set<string>();
  for (const a of raw.accounts) {
    ensure(identifier(a.accountNumber) && identifier(a.brokerCode) && seen.has(a.brokerCode) && !seenAccounts.has(a.accountNumber), 'FORBIDDEN_SCOPE');
    seenAccounts.add(a.accountNumber); accounts.push({ accountNumber: a.accountNumber, brokerCode: a.brokerCode });
  }
  return { accounts, brokers, subaccounts: [] };
}
export class Policy {
  constructor(readonly session: Session, readonly vault: Vault, readonly entitlements: Entitlements) {}
  ref(kind: string, value: string) { return `${kind}_${this.vault.digest(`ref:${this.session.teamId}:${this.session.userId}:${this.session.id}:${this.session.generation}:${kind}:${value}`).slice(0, 40)}`; }
  account(ref: string) { const a = this.entitlements.accounts.find(a => this.ref('acct', a.accountNumber) === ref); ensure(a, 'FORBIDDEN_SCOPE'); return a; }
  subaccount(ref: string, accountNo?: string) { const s = this.entitlements.subaccounts.find(s => this.ref('sub', s.subId) === ref); ensure(s && (!accountNo || s.accountNo === accountNo), 'FORBIDDEN_SCOPE'); return s; }
  broker(ref?: string) {
    const options = this.entitlements.brokers.filter(b => this.session.identity.brokerCodes.includes(b.brokerCode));
    ensure(ref || options.length === 1, 'AMBIGUOUS_SCOPE');
    const b = ref ? this.entitlements.brokers.find(b => this.ref('broker', b.brokerCode) === ref) : options[0]; ensure(b, 'FORBIDDEN_SCOPE'); return b;
  }
  subtree(code: string): string[] { const b = this.entitlements.brokers.find(b => b.brokerCode === code); ensure(b, 'FORBIDDEN_SCOPE'); return [code, ...b.children.flatMap(c => this.subtree(c))]; }
  accounts(refs?: string[], broker?: string) { return refs?.map(ref => { const a = this.account(ref); ensure(!broker || this.subtree(broker).includes(a.brokerCode), 'FORBIDDEN_SCOPE'); return a.accountNumber; }) ?? []; }
  checkResponse(value: unknown, accountNos?: string[], broker?: string): void {
    if (Array.isArray(value)) { for (const x of value) this.checkResponse(x, accountNos, broker); return; }
    if (!value || typeof value !== 'object') return;
    const row = value as Json;
    // acntNo is the account key of portfolio rows (SHA_PC docs); acctNo is a loan id and is not an account.
    for (const key of ['accountNo', 'accountNumber', 'acntNo']) if (row[key] != null) {
      ensure(this.entitlements.accounts.some(a => a.accountNumber === row[key] && (!broker || this.subtree(broker).includes(a.brokerCode))), 'FORBIDDEN_SCOPE');
      ensure(!accountNos?.length || accountNos.includes(row[key]), 'FORBIDDEN_SCOPE');
    }
    if (row.brokerCode != null) ensure(this.entitlements.brokers.some(b => b.brokerCode === row.brokerCode) && (!broker || this.subtree(broker).includes(row.brokerCode)), 'FORBIDDEN_SCOPE');
    for (const x of Object.values(row)) if (x && typeof x === 'object') this.checkResponse(x, accountNos, broker);
  }
}
