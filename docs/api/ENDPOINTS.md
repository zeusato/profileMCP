# Hợp đồng tra cứu SHA: danh mục triển khai

Ngày rà soát: 09/10/2026; cập nhật release 10/10/2026. **42 method/path tra cứu** (40 gốc + 2 KMS), nhóm thành **18 tool nghiệp vụ**; 39 bật, 3 tắt — trạng thái từng operation ghi ở dòng "Release 10/10/2026" trong mục của nó. Cộng thêm 2 tool metadata nội bộ, không gọi upstream.

Nguồn JSON chuẩn: [sha-read-candidates.json](../../config/sha-read-candidates.json). Schema input: [tool-input-schemas.json](../../config/tool-input-schemas.json). Schema này là thiết kế; cần Zod/JSON Schema validation thực khi implementation. Quy tắc giải mã ngày, scope, phân trang, đơn vị và null nằm trong [TRANSPORT](TRANSPORT.md) và [DATA-QUALITY](DATA-QUALITY.md).

Mỗi bảng field dưới đây là allowlist output tối thiểu. Field không liệt kê bị loại bỏ. Các field nested-mapped/unverified chưa có DTO con hoàn chỉnh phải qua G2 trước khi trả dữ liệu. Không dùng raw object spread. Mọi đơn vị có hậu tố source mới là mô tả từ nguồn, chưa được phiên này xác minh live.

| Operation | Tool | Method/path | Gate |
|---|---|---|---|
| identity.current | get_profile_identity | GET `/prod/v2/sha-service/e/user/get-user-login` | G2-contract |
| accounts.tree | list_managed_accounts | GET `/prod/v2/sha-service/e/account/account-no-and-rem` | G2-contract |
| accounts.search | list_managed_accounts | POST `/prod/v2/sha-service/e/account/list-by-rem-no` | G2-contract |
| accounts.subaccounts | list_managed_accounts | GET `/prod/v2/sha-service/e/account/list-sub-no` | G2-contract |
| profile.detail | get_account_profile | GET `/prod/v2/sha-service/e/account/detail` | G2-contract |
| profile.information | get_account_profile | GET `/prod/v2/sha-service/e/account/information` | G2-contract |
| profile.authorized | get_account_profile | GET `/prod/v2/sha-service/e/account/authorized` | G2-nonempty-shape |
| customers.overview | get_customer_overview | GET `/prod/v2/sha-service/e/account/customers-overview` | G2-contract |
| assets.cash | get_account_assets | GET `/prod/v2/sha-service/e/asset/money-information` | G2-contract |
| assets.stockValue | get_account_assets | GET `/prod/v2/sha-service/e/asset/stock-value` | G2-contract |
| assets.margin | get_account_assets | GET `/prod/v2/sha-service/e/asset/margin-info` | G2-contract |
| assets.loanSummary | get_account_assets | GET `/prod/v2/sha-service/e/asset/loan-information` | G2-contract |
| assets.loanDetail | get_account_assets | GET `/prod/v2/sha-service/e/asset/loan-info` | G2-contract |
| portfolio.account | get_account_portfolio | GET `/prod/v2/sha-service/e/asset/portfolio-investment-stock` | G2-contract |
| brokerAssets.summary | get_broker_assets | GET `/prod/v2/sha-service/e/asset/summary` | G2-contract |
| brokerAssets.accounts | get_broker_assets | POST `/prod/v2/sha-service/e/asset/information` | G2-contract |
| brokerAssets.cash | get_broker_assets | POST `/prod/v2/sha-service/e/asset/cash-information` | G2-contract |
| brokerAssets.portfolio | get_broker_assets | POST `/prod/v2/sha-service/e/asset/investment-portfolio` | G2-contract |
| credit.guarantees | get_credit_risk | POST `/prod/v2/sha-service/e/asset/guarantee-information-list` | G2-variant-scope |
| credit.collateral | get_credit_risk | POST `/prod/v2/sha-service/e/asset/additional-collateral-releases-list` | G2-variant-scope |
| loans.current | get_loan_records | POST `/prod/v2/sha-service/e/asset/loan-info` | G2-variant-shape |
| loans.history | get_loan_records | POST `/prod/v2/sha-service/e/asset/loan-info/history` | G2-contract |
| loans.repayments | get_loan_records | POST `/prod/v2/sha-service/e/asset/debt-info/history` | G2-contract |
| orders.history | get_order_records | POST `/prod/v2/sha-service/e/order/histories` | G2-contract |
| orders.unconfirmed | get_order_records | POST `/prod/v2/sha-service/e/order/list-confirm` | G2-identity-binding |
| orderSummary.account | get_order_summary | GET `/prod/v2/sha-service/e/order/order-account-summary` | G2-nonempty-and-semantics |
| orderSummary.confirmations | get_order_summary | GET `/prod/v2/sha-service/e/order/order-confirm-summary` | G2-identity-binding |
| orderSummary.top | get_order_summary | GET `/prod/v2/sha-service/e/order/summary` | G2-nonempty-shape |
| orderSummary.transactions | get_order_summary | POST `/prod/v2/sha-service/e/order/sum-transaction` | G2-report-period |
| buyingPower.preview | get_buying_power | POST `/prod/v2/sha-service/e/order/balance` | G2-input-price-unit |
| cash.movements | get_cash_movements | POST `/prod/v2/sha-service/e/account/deposit-withdrawal-info` | G2-contract |
| newAccounts.report | get_new_accounts_report | POST `/prod/v2/sha-service/e/performance/open-new-account` | G2-custid-mnId |
| research.summary | get_research | POST `/prod/v2/sha-advice/e/dashboard/info-advice` | G2-contract |
| research.list | get_research | POST `/prod/v2/sha-advice/e/get-all` | G2-contract |
| groups.list | list_customer_groups | POST `/prod/v2/sha-customer/e/customer-group/get-all-group-customer` | G2-contract |
| market.catalog | get_sha_market_data | GET `/prod/v2/sha-service/e/market/get-stock-codes` | G2-contract |
| market.quote | get_sha_market_data | POST `/prod/v2/sha-service/e/market/stock/code` | G2-contract |
| market.price | get_sha_market_data | GET `/prod/v2/sha-service/e/market/securities-price` | G2-variant-shape |
| market.ticks | get_sha_market_data | GET `/prod/v2/sha-system/e/trading/stock-quote-list` | G2-contract |
| market.candles | get_sha_market_data | GET `/prod/v2/advisor-service/e/market/tradingview/history` | G2-contract |

## identity.current

- **Release 10/10/2026: bật.** 9 field (1 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_profile_identity`; `GET /prod/v2/sha-service/e/user/get-user-login`.
- Input bắt buộc: operation. Input được phép: operation; field khác bị từ chối.
- Request: query=none; body=none.
- Envelope/raw: SHA envelope data: array.
- Ghi chú: Bootstrap only after bearer verification; multiple rows do not imply every root authorized. Missing identity => fail closed.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:949; hash trong manifest.
- Test cần viết: `REQ-identity.current`, `RAW-identity.current`, `DTO-identity.current`, `SCOPE-identity.current`, `PAGE-identity.current`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `brokerCode` | `brokerCode` | identifier |
| `preferredUsername` | `preferredUsername` | identifier |
| `branchCode` | `branchCode` | identifier |
| `brokerName` | `brokerName` | text |
| `saleGroupNo` | `saleGroupNo` | identifier |
| `saleGroupName` | `saleGroupName` | text |
| `positionLevel` | `positionLevel` | raw-enum |

## accounts.tree

- **Release 10/10/2026: bật.** 11 field (2 field sau profile.pii); bằng chứng: live-shape-verified-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `list_managed_accounts`; `GET /prod/v2/sha-service/e/account/account-no-and-rem`.
- Input bắt buộc: operation. Input được phép: operation; field khác bị từ chối.
- Request: query=none; body=none.
- Envelope/raw: data object accounts[] + brokers[].
- Ghi chú: Scope bootstrap. Detect cycles/duplicates; brokerCode is not login username. Tree grants must agree with current identity/upstream entitlements.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:178; hash trong manifest.
- **Released 10/10/2026** (config/runtime-release.json). Shape live 10/10/2026: accounts{accountNumber, customerName, brokerCode, remNo}; brokers{brokerCode, brokerName, level, remNo, remMng, children, accounts}. Dùng chính response bootstrap, không gọi lần hai.
- Output: accounts[] {accountRef, displayNumber ***xxx, brokerRef, brokerCode; accountNumber và customerName chỉ khi có profile.pii}; brokers[] {brokerRef, brokerCode, brokerName chỉ khi có profile.pii, children (brokerRef), directAccounts}. Tối đa 400 tài khoản, quá thì coverage.truncated + PARTIAL_PAGE.
- Test: `REQ-accounts.tree`, `RAW-accounts.tree`, `DTO-accounts.tree`, `SCOPE-accounts.tree`, `PAGE-accounts.tree` trong tests/accounts-tree.test.ts, passed 10/10/2026; E2E SDK trong tests/oauth.test.ts.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `accounts[].accountNumber` | `accounts[].accountRef` | opaque-reference |
| `accounts[].brokerCode` | `accounts[].brokerCode` | identifier |
| `brokers[].brokerCode` | `brokers[].brokerRef` | opaque-reference |
| `brokers[].children` | `brokers[].children` | tree |
| `brokers[].remMng` | `brokers[].remMng` | identifier |

## accounts.search

- **Release 10/10/2026: bật.** 23 field (17 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `list_managed_accounts`; `POST /prod/v2/sha-service/e/account/list-by-rem-no`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef, accountRefs, search, birthYearFrom, birthYearTo, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body={accountNumbers:resolve(accountRefs) or [],remNos:[B.code],fromBirthYear:birthYearFrom as string or '',toBirthYear:birthYearTo as string or '',searchKey:search or '',page,size}; page=cursor.page or 1; size=limit or 50; cursor bound to subject+sessionGeneration+operation+filters.
- Envelope/raw: data {page,size,totalElements,totalPages,data:rows[]}.
- Ghi chú: No openDt in this response. Birth ranges must be paired and ordered. Empty accountNumbers behavior must be proven as selected authorized broker scope.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:320; hash trong manifest.
- Test cần viết: `REQ-accounts.search`, `RAW-accounts.search`, `DTO-accounts.search`, `SCOPE-accounts.search`, `PAGE-accounts.search`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `data[].accountNumber` | `items[].accountRef` | opaque-reference |
| `data[].customerName` | `items[].customerDisplay` | masked-text |
| `data[].status` | `data[].status` | raw-enum |
| `totalElements` | `totalElements` | count |
| `totalPages` | `totalPages` | count |

## accounts.subaccounts

- **Release 10/10/2026: bật.** 7 field (1 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `list_managed_accounts`; `GET /prod/v2/sha-service/e/account/list-sub-no`.
- Input bắt buộc: operation, accountRefs. Input được phép: operation, accountRefs; field khác bị từ chối.
- Request: query accountNos=resolved accountNumbers joined by comma; body=none.
- Envelope/raw: data array.
- Ghi chú: subNo display 00/01 differs from internal subId; do not concatenate an account to guess subId.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:202; hash trong manifest.
- Test cần viết: `REQ-accounts.subaccounts`, `RAW-accounts.subaccounts`, `DTO-accounts.subaccounts`, `SCOPE-accounts.subaccounts`, `PAGE-accounts.subaccounts`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `accountNo` | `items[].accountRef` | opaque-reference |
| `subAccounts[].subNo` | `subaccounts[].displayNumber` | identifier |
| `subAccounts[].subId` | `subaccounts[].subaccountRef` | opaque-reference |
| `subAccounts[].subTp` | `subAccounts[].subTp` | raw-enum |
| `subAccounts[].subName` | `subAccounts[].subName` | text |

## profile.detail

- **Release 10/10/2026: bật.** 35 field (29 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_account_profile`; `GET /prod/v2/sha-service/e/account/detail`.
- Input bắt buộc: operation, accountRef. Input được phép: operation, accountRef; field khác bị từ chối.
- Request: query accountNo=resolve(accountRef).accountNo; body=none.
- Envelope/raw: data object.
- Ghi chú: Default omit identity document, full phone, email, birth date and address. Explicit profile.pii scope can enable individually mapped fields; no raw object spread.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:221; hash trong manifest.
- Test cần viết: `REQ-profile.detail`, `RAW-profile.detail`, `DTO-profile.detail`, `SCOPE-profile.detail`, `PAGE-profile.detail`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `accountNo` | `accountRef` | opaque-reference |
| `custNm` | `customerDisplay` | masked-text |
| `idNo` | `identityDocument` | restricted |
| `mobile_sms` | `phone` | restricted |
| `email` | `email` | restricted |
| `address` | `address` | restricted |
| `acntTp` | `accountType` | raw-enum |
| `grpTp` | `customerGroup` | raw-enum |

## profile.information

- **Release 10/10/2026: bật.** 21 field (3 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_account_profile`; `GET /prod/v2/sha-service/e/account/information`.
- Input bắt buộc: operation, accountRef. Input được phép: operation, accountRef; field khác bị từ chối.
- Request: query accountNo=resolve(accountRef).accountNo; body=none.
- Envelope/raw: data object.
- Ghi chú: Preserve unknown status values with label=null; htsId and contract number omitted by default.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:234; hash trong manifest.
- Test cần viết: `REQ-profile.information`, `RAW-profile.information`, `DTO-profile.information`, `SCOPE-profile.information`, `PAGE-profile.information`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `accountNo` | `accountRef` | opaque-reference |
| `acntStat` | `status` | raw-enum |
| `openDt` | `openedOn` | source-date |
| `remNo` | `brokerId` | identifier |
| `remNm` | `brokerName` | text |
| `mngBnh` | `branch` | identifier |
| `ekycYn` | `ekycStatus` | raw-enum |

## profile.authorized

- **Release 10/10/2026: tắt.** live 10/10/2026 trả data null cho cả 8 tài khoản; chưa có shape.
- Tool: `get_account_profile`; `GET /prod/v2/sha-service/e/account/authorized`.
- Input bắt buộc: operation, accountRef. Input được phép: operation, accountRef; field khác bị từ chối.
- Request: query accountNo=resolve(accountRef).accountNo; body=none.
- Envelope/raw: Only data:null evidenced in source.
- Ghi chú: Do not infer no authorized people from null. No usable DTO until a sanitized nonempty fixture proves fields.
- Gate: **G2-nonempty-shape**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:247; hash trong manifest.
- Test cần viết: `REQ-profile.authorized`, `RAW-profile.authorized`, `DTO-profile.authorized`, `SCOPE-profile.authorized`, `PAGE-profile.authorized`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `data` | `authorizedPersons` | unverified |

## customers.overview

- **Release 10/10/2026: bật.** 14 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_customer_overview`; `GET /prod/v2/sha-service/e/account/customers-overview`.
- Input bắt buộc: operation, from, to. Input được phép: operation, brokerRef, from, to; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; query brokerCode=B.code,fromDate=ymd(from),toDate=ymd(to); body=none.
- Envelope/raw: data object.
- Ghi chú: Require date range; counts and ratios have different denominators. Do not derive a ratio without confirming denominator.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:253; hash trong manifest.
- Test cần viết: `REQ-customers.overview`, `RAW-customers.overview`, `DTO-customers.overview`, `SCOPE-customers.overview`, `PAGE-customers.overview`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `customersCnt` | `customers` | count |
| `individualCnt` | `individuals` | count |
| `institutionalCnt` | `institutions` | count |
| `activeCnt` | `active` | count |
| `closedCnt` | `closed` | count |
| `newAccounts` | `newAccounts` | count |
| `newActivedAcc` | `newActivedAcc` | count |
| `newClosedAcc` | `newClosedAcc` | count |
| `ratio1` | `ratio1` | unverified |
| `ratio2` | `ratio2` | unverified |
| `ratio3` | `ratio3` | unverified |
| `ratio4` | `ratio4` | unverified |

## assets.cash

- **Release 10/10/2026: bật.** 22 field (1 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_account_assets`; `GET /prod/v2/sha-service/e/asset/money-information`.
- Input bắt buộc: operation, accountRef, subaccountRef. Input được phép: operation, accountRef, subaccountRef; field khác bị từ chối.
- Request: query accountNo=resolve(accountRef).accountNo; afAccountNo=resolve(subaccountRef).subId; assert subaccount belongs to account; body=none.
- Envelope/raw: data object; numeric strings.
- Ghi chú: Map decimal strings exactly. Source monetary descriptions require live magnitude checks before unit status verified.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:343; hash trong manifest.
- Test cần viết: `REQ-assets.cash`, `RAW-assets.cash`, `DTO-assets.cash`, `SCOPE-assets.cash`, `PAGE-assets.cash`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `cashTotal` | `cashTotal` | VND-source |
| `firstCashTotal` | `firstCashTotal` | VND-source |
| `changeCash` | `changeCash` | VND-source |
| `rateCash` | `rateCash` | unverified |
| `cashNotHold` | `cashNotHold` | VND-source |
| `cashHold` | `cashHold` | VND-source |
| `lndAblAmt` | `lndAblAmt` | VND-source |
| `d0TotDpo` | `d0TotDpo` | VND-source |
| `d1TotDpo` | `d1TotDpo` | VND-source |
| `d2TotDpo` | `d2TotDpo` | VND-source |
| `depFee` | `depFee` | VND-source |
| `smsFee` | `smsFee` | VND-source |

## assets.stockValue

- **Release 10/10/2026: bật.** 22 field (2 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_account_assets`; `GET /prod/v2/sha-service/e/asset/stock-value`.
- Input bắt buộc: operation, accountRef, subaccountRef. Input được phép: operation, accountRef, subaccountRef; field khác bị từ chối.
- Request: query accountNo=resolve(accountRef).accountNo; afAccountNo=resolve(subaccountRef).subId; assert subaccount belongs to account; body=none.
- Envelope/raw: data object; numeric strings.
- Ghi chú: Current snapshot, not historical NAV. Price or timestamp from another provider must not be substituted.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:351; hash trong manifest.
- Test cần viết: `REQ-assets.stockValue`, `RAW-assets.stockValue`, `DTO-assets.stockValue`, `SCOPE-assets.stockValue`, `PAGE-assets.stockValue`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `firstAssetTotal` | `firstAssetTotal` | VND-source |
| `firstNav` | `firstNav` | VND-source |
| `allValue` | `allValue` | VND-source |
| `changeAllValue` | `changeAllValue` | VND-source |
| `rateAllValue` | `rateAllValue` | unverified |
| `ablSecurValue` | `ablSecurValue` | VND-source |
| `blockValue` | `blockValue` | VND-source |
| `buyWaitingValue` | `buyWaitingValue` | VND-source |
| `buyT0Value` | `buyT0Value` | VND-source |
| `buyT1Value` | `buyT1Value` | VND-source |
| `buyT2Value` | `buyT2Value` | VND-source |
| `pendingSubRights` | `pendingSubRights` | VND-source |
| `delayValue` | `delayValue` | VND-source |

## assets.margin

- **Release 10/10/2026: bật.** 28 field (1 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_account_assets`; `GET /prod/v2/sha-service/e/asset/margin-info`.
- Input bắt buộc: operation, accountRef, subaccountRef. Input được phép: operation, accountRef, subaccountRef; field khác bị từ chối.
- Request: query accountNo=resolve(accountRef).accountNo; afAccountNo=resolve(subaccountRef).subId; assert subaccount belongs to account; subId=resolved subId; body=none.
- Envelope/raw: data object.
- Ghi chú: Read margin status only; no cash transfer or limit change. Null risk measures are unknown.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:359; hash trong manifest.
- Test cần viết: `REQ-assets.margin`, `RAW-assets.margin`, `DTO-assets.margin`, `SCOPE-assets.margin`, `PAGE-assets.margin`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `cashBalance` | `cashBalance` | VND-source |
| `securitiesValue` | `securitiesValue` | VND-source |
| `netAssetValue` | `netAssetValue` | VND-source |
| `withdrawableAmount` | `withdrawableAmount` | VND-source |
| `baseBuyingPower` | `baseBuyingPower` | VND-source |
| `maxLoanLimit` | `maxLoanLimit` | VND-source |
| `remainingLoanLimit` | `remainingLoanLimit` | VND-source |
| `convertedDebt` | `convertedDebt` | VND-source |
| `requiredDeposit` | `requiredDeposit` | VND-source |
| `expectedDisbursement` | `expectedDisbursement` | VND-source |
| `marginRatio` | `marginRatio` | unverified |
| `initialMarginRate` | `initialMarginRate` | unverified |
| `subAccountStatus` | `subAccountStatus` | raw-enum |

## assets.loanSummary

- **Release 10/10/2026: bật.** 17 field (1 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_account_assets`; `GET /prod/v2/sha-service/e/asset/loan-information`.
- Input bắt buộc: operation, accountRef, subaccountRef. Input được phép: operation, accountRef, subaccountRef; field khác bị từ chối.
- Request: query accountNo=resolve(accountRef).accountNo; afAccountNo=resolve(subaccountRef).subId; assert subaccount belongs to account; body=none.
- Envelope/raw: data object.
- Ghi chú: Keep this route separate from GET loan-info and POST loan-info.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:367; hash trong manifest.
- Test cần viết: `REQ-assets.loanSummary`, `RAW-assets.loanSummary`, `DTO-assets.loanSummary`, `SCOPE-assets.loanSummary`, `PAGE-assets.loanSummary`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `loanTotal` | `loanTotal` | VND-source |
| `mgnLoanAmt` | `mgnLoanAmt` | VND-source |
| `colLoanAmt` | `colLoanAmt` | VND-source |
| `buyLoanAmt` | `buyLoanAmt` | VND-source |
| `loanInt` | `loanInt` | VND-source |
| `notYetMthAmt` | `notYetMthAmt` | VND-source |
| `marginRatio` | `marginRatio` | unverified |
| `marginCall` | `marginCall` | unverified |
| `marginForce` | `marginForce` | unverified |

## assets.loanDetail

- **Release 10/10/2026: tắt.** GET loan-info trả HTTP 405 live; khoản vay dùng loans.current (POST cùng path).
- Tool: `get_account_assets`; `GET /prod/v2/sha-service/e/asset/loan-info`.
- Input bắt buộc: operation, accountRef, subaccountRef. Input được phép: operation, accountRef, subaccountRef; field khác bị từ chối.
- Request: query accountNo=resolve(accountRef).accountNo; afAccountNo=resolve(subaccountRef).subId; assert subaccount belongs to account; body=none.
- Envelope/raw: data object.
- Ghi chú: GET method means subaccount aggregate, POST same path means paginated loan records.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:1218; hash trong manifest.
- Test cần viết: `REQ-assets.loanDetail`, `RAW-assets.loanDetail`, `DTO-assets.loanDetail`, `SCOPE-assets.loanDetail`, `PAGE-assets.loanDetail`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `loanTotal` | `loanTotal` | VND-source |
| `mgnLoanAmt` | `mgnLoanAmt` | VND-source |
| `colLoanAmt` | `colLoanAmt` | VND-source |
| `mnyLoanNowrm` | `mnyLoanNowrm` | VND-source |
| `buyLoanAmt` | `buyLoanAmt` | VND-source |
| `allPrfNet` | `allPrfNet` | VND-source |
| `notYetMthAmt` | `notYetMthAmt` | VND-source |
| `loanInt` | `loanInt` | VND-source |
| `marginRatio` | `marginRatio` | unverified |
| `mainMargin` | `mainMargin` | unverified |
| `marginCall` | `marginCall` | unverified |
| `marginForce` | `marginForce` | unverified |

## portfolio.account

- **Release 10/10/2026: bật.** 18 field (0 field sau profile.pii); bằng chứng: live-connector-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_account_portfolio`; `GET /prod/v2/sha-service/e/asset/portfolio-investment-stock`.
- Input bắt buộc: operation, accountRef, subaccountRef. Input được phép: operation, accountRef, subaccountRef; field khác bị từ chối.
- Request: query accountNo=resolve(accountRef).accountNo; afAccountNo=resolve(subaccountRef).subId; assert subaccount belongs to account; subId=resolved subId; body=none.
- Envelope/raw: data array.
- Ghi chú: Totals repeated in rows: use one only after equality checks, never sum repeated totals. Quantity unit may be shares or other instrument units; classify security first.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:375; hash trong manifest.
- Test cần viết: `REQ-portfolio.account`, `RAW-portfolio.account`, `DTO-portfolio.account`, `SCOPE-portfolio.account`, `PAGE-portfolio.account`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `stkCd` | `items[].symbol` | symbol |
| `ownQty` | `items[].ownedQuantity` | security-units |
| `sellAbleQty` | `items[].sellableQuantity` | security-units |
| `costPri` | `items[].costPrice` | unverified |
| `curPri` | `items[].currentPrice` | unverified |
| `bookAmtPl` | `items[].costValue` | VND-source |
| `evalAmt` | `items[].marketValue` | VND-source |
| `evalPrf` | `items[].profitLoss` | VND-source |
| `evalPer` | `items[].profitLossRate` | unverified |
| `bookAmtSum` | `totals.cost` | VND-source |
| `evalAmtSum` | `totals.value` | VND-source |
| `evalSumPrf` | `totals.profitLoss` | VND-source |

## brokerAssets.summary

- **Release 10/10/2026: bật.** 15 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_broker_assets`; `GET /prod/v2/sha-service/e/asset/summary`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; query remNo=B.code; body=none.
- Envelope/raw: data object plus data rows.
- Ghi chú: Snapshot totals are not a historical performance series. Verify nested rows account ownership before returning.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:415; hash trong manifest.
- Test cần viết: `REQ-brokerAssets.summary`, `RAW-brokerAssets.summary`, `DTO-brokerAssets.summary`, `SCOPE-brokerAssets.summary`, `PAGE-brokerAssets.summary`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `sumAssets` | `totals.assets` | VND-source |
| `sumBgnSsnNav` | `totals.openingNav` | VND-source |
| `sumNav` | `totals.nav` | VND-source |
| `sumLndAmt` | `totals.debt` | VND-source |
| `sumCashTotal` | `totals.cash` | VND-source |
| `sumStkAmtTotal` | `totals.stock` | VND-source |
| `change` | `change` | VND-source |
| `rate` | `rate` | unverified |
| `data[].nav` | `data[].nav` | VND-source |

## brokerAssets.accounts

- **Release 10/10/2026: bật.** 22 field (2 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_broker_assets`; `POST /prod/v2/sha-service/e/asset/information`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef, accountRefs, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body brokerCode=B.code,accountNumbers=resolved accountRefs or [],page,size; page=cursor.page or 1; size=limit or 50; cursor bound to subject+sessionGeneration+operation+filters.
- Envelope/raw: data page wrapper with list[].
- Ghi chú: Nested children require independent schema and account/subaccount scope checks; no recursive raw passthrough.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:433; hash trong manifest.
- Test cần viết: `REQ-brokerAssets.accounts`, `RAW-brokerAssets.accounts`, `DTO-brokerAssets.accounts`, `SCOPE-brokerAssets.accounts`, `PAGE-brokerAssets.accounts`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `sumAccountNumber` | `totals.accounts` | count |
| `sumNav` | `totals.nav` | VND-source |
| `sumStock` | `totals.stock` | VND-source |
| `sumCash` | `totals.cash` | VND-source |
| `sumDebt` | `totals.debt` | VND-source |
| `sumAssets` | `totals.assets` | VND-source |
| `list[].accountNumber` | `items[].accountRef` | opaque-reference |
| `list[].children` | `items[].subaccounts` | nested-mapped |
| `list[].marginNav.percentMargin` | `list[].marginNav.percentMargin` | unverified |

## brokerAssets.cash

- **Release 10/10/2026: bật.** 22 field (2 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_broker_assets`; `POST /prod/v2/sha-service/e/asset/cash-information`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef, accountRefs, search, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body remNo=B.code,accountNumbers=resolved accountRefs or [],searchValue=search or '',page,size; page=cursor.page or 1; size=limit or 50; cursor bound to subject+sessionGeneration+operation+filters.
- Envelope/raw: data page wrapper list[].
- Ghi chú: Displayed cash is not withdrawable amount; do not relabel.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:1203; hash trong manifest.
- Test cần viết: `REQ-brokerAssets.cash`, `RAW-brokerAssets.cash`, `DTO-brokerAssets.cash`, `SCOPE-brokerAssets.cash`, `PAGE-brokerAssets.cash`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `sumAccountNumber` | `totals.accounts` | count |
| `sumCash` | `totals.cash` | VND-source |
| `sumCashBalance` | `totals.balance` | VND-source |
| `sumAwaitingAdvance` | `totals.awaitingAdvance` | VND-source |
| `sumAwaitingDividends` | `totals.awaitingDividends` | VND-source |
| `sumBlockedCash` | `totals.blocked` | VND-source |
| `sumNotMatched` | `totals.notMatched` | VND-source |
| `sumUnpaid` | `totals.unpaid` | VND-source |
| `list[].accountNumber` | `items[].accountRef` | opaque-reference |
| `list[].cash` | `list[].cash` | VND-source |
| `list[].children` | `list[].children` | nested-mapped |

## brokerAssets.portfolio

- **Release 10/10/2026: bật.** 16 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_broker_assets`; `POST /prod/v2/sha-service/e/asset/investment-portfolio`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body tlId=B.code,page,size; page=cursor.page or 1; size=limit or 50; cursor bound to subject+sessionGeneration+operation+filters.
- Envelope/raw: data page wrapper data[] and nested list[].
- Ghi chú: tlId must come from verified broker scope. Nested account details can be omitted for least-data output.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:1213; hash trong manifest.
- Test cần viết: `REQ-brokerAssets.portfolio`, `RAW-brokerAssets.portfolio`, `DTO-brokerAssets.portfolio`, `SCOPE-brokerAssets.portfolio`, `PAGE-brokerAssets.portfolio`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `sumAllAcc` | `totals.accounts` | count |
| `data[].stkCd` | `items[].symbol` | symbol |
| `data[].acntQty` | `items[].accounts` | count |
| `data[].evalAmtSum` | `items[].value` | VND-source |
| `data[].bookAmtPlSum` | `items[].cost` | VND-source |
| `data[].evalPrf` | `items[].profitLoss` | VND-source |
| `data[].evalPer` | `data[].evalPer` | unverified |
| `data[].ownQtySum` | `data[].ownQtySum` | security-units |
| `data[].sellAbleQtySum` | `data[].sellAbleQtySum` | security-units |
| `data[].porWgt` | `data[].porWgt` | unverified |
| `data[].list` | `data[].list` | nested-mapped |

## credit.guarantees

- **Release 10/10/2026: bật.** 34 field (2 field sau profile.pii); bằng chứng: doc-only-live-sample-empty. Đơn vị số liệu gắn status unverified.
- Tool: `get_credit_risk`; `POST /prod/v2/sha-service/e/asset/guarantee-information-list`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef, accountRefs, subaccountRef, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body brokerCode=B.code,accounts=resolved accountRefs or explicit broker-scope value,subId=resolved optional subaccountRef,page,size; page=cursor.page or 1; size=limit or 50; cursor bound to subject+sessionGeneration+operation+filters.
- Envelope/raw: data page wrapper data[].
- Ghi chú: Account and broker variants share one operation. Preserve lowercase adv1; missing is not zero. Optional subaccount must resolve inside selected accountRefs.
- Gate: **G2-variant-scope**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:445; docs/api/api-documentation.md:493; hash trong manifest.
- Test cần viết: `REQ-credit.guarantees`, `RAW-credit.guarantees`, `DTO-credit.guarantees`, `SCOPE-credit.guarantees`, `PAGE-credit.guarantees`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `data[].accountNo` | `items[].accountRef` | opaque-reference |
| `data[].subId` | `items[].subaccountRef` | opaque-reference |
| `data[].blIssuedToday` | `data[].blIssuedToday` | VND-source |
| `data[].minDeposit` | `data[].minDeposit` | VND-source |
| `data[].safeRttSmDeposit` | `data[].safeRttSmDeposit` | VND-source |
| `data[].adv1` | `data[].adv1` | unverified |
| `data[].advanceAmount` | `data[].advanceAmount` | VND-source |
| `data[].rtt` | `data[].rtt` | unverified |
| `data[].rttSm` | `data[].rttSm` | unverified |
| `data[].guaranteeDebt` | `data[].guaranteeDebt` | VND-source |
| `data[].marginDebt` | `data[].marginDebt` | VND-source |
| `data[].convertedDebt` | `data[].convertedDebt` | VND-source |

## credit.collateral

- **Release 10/10/2026: bật.** 28 field (2 field sau profile.pii); bằng chứng: doc-only-live-sample-empty. Đơn vị số liệu gắn status unverified.
- Tool: `get_credit_risk`; `POST /prod/v2/sha-service/e/asset/additional-collateral-releases-list`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef, accountRefs, subaccountRef, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body brokerCode=B.code,accounts=resolved accountRefs,subId=resolved optional subaccountRef,page,size; page=cursor.page or 1; size=limit or 50; cursor bound to subject+sessionGeneration+operation+filters.
- Envelope/raw: data page wrapper data[]; verify broker variant.
- Ghi chú: Read collateral risk list only. Name releases does not authorize executing releases or force-sell.
- Gate: **G2-variant-scope**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:476; hash trong manifest.
- Test cần viết: `REQ-credit.collateral`, `RAW-credit.collateral`, `DTO-credit.collateral`, `SCOPE-credit.collateral`, `PAGE-credit.collateral`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `data[].violationType` | `data[].violationType` | raw-enum |
| `data[].treatmentType` | `data[].treatmentType` | raw-enum |
| `data[].actualRatio` | `data[].actualRatio` | unverified |
| `data[].maintenanceRatio` | `data[].maintenanceRatio` | unverified |
| `data[].liquidationRatio` | `data[].liquidationRatio` | unverified |
| `data[].convertedOutstandingDebt` | `data[].convertedOutstandingDebt` | VND-source |
| `data[].collateralAssetValue` | `data[].collateralAssetValue` | VND-source |
| `data[].requiredAdditionalDeposit` | `data[].requiredAdditionalDeposit` | VND-source |
| `data[].maxForceSellAmt` | `data[].maxForceSellAmt` | VND-source |
| `data[].remainForceSellAmt` | `data[].remainForceSellAmt` | VND-source |
| `data[].firstMarginCallDate` | `data[].firstMarginCallDate` | source-date |

## loans.current

- **Release 10/10/2026: bật.** 28 field (3 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_loan_records`; `POST /prod/v2/sha-service/e/asset/loan-info`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef, accountRefs, loanStatus, loanFrom, loanTo, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body remNo=B.code,accounts=resolved accountRefs,loanStatus=input or ['0','1','2'],lndTp=null,mnId=null,fromLndDate=ymd(loanFrom) or null,toLndDate=ymd(loanTo) or null; other source filters fixed null only after fixture; page=cursor.page or 1; size=limit or 50; cursor bound to subject+sessionGeneration+operation+filters.
- Envelope/raw: data page wrapper; rows data.data OR data.list as explicitly versioned variants.
- Ghi chú: Unique loan tuple=(accountNo,acctNo,subNo,normalized lndDate,lndTp). sumInt includes interest and fees; no double counting. Enum labels 0/1/2 remain unknown until verified.
- Gate: **G2-variant-shape**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:1222; hash trong manifest.
- Test cần viết: `REQ-loans.current`, `RAW-loans.current`, `DTO-loans.current`, `SCOPE-loans.current`, `PAGE-loans.current`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `accountNo` | `items[].accountRef` | opaque-reference |
| `acctNo` | `items[].loanId` | identifier |
| `subNo` | `subNo` | identifier |
| `lndTp` | `items[].loanType` | raw-enum |
| `lndDate` | `items[].loanDate` | source-date |
| `expDate` | `items[].expiryDate` | source-date |
| `initialDebt` | `initialDebt` | VND-source |
| `paidDebt` | `paidDebt` | VND-source |
| `remainingDebt` | `remainingDebt` | VND-source |
| `lndInt` | `lndInt` | VND-source |
| `dlyInt` | `dlyInt` | VND-source |
| `lndCmsn` | `lndCmsn` | VND-source |
| `dlyCmsn` | `dlyCmsn` | VND-source |
| `sumInt` | `sumInt` | VND-source |
| `totalDueAmount` | `totalDueAmount` | VND-source |
| `loanStatus` | `loanStatus` | raw-enum |
| `crm` | `crm` | unverified |

## loans.history

- **Release 10/10/2026: bật.** 31 field (3 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_loan_records`; `POST /prod/v2/sha-service/e/asset/loan-info/history`.
- Input bắt buộc: operation, from, to. Input được phép: operation, brokerRef, accountRefs, from, to, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body remNo=B.code,accounts=resolved accountRefs,fromLndDate=ymd(from),toLndDate=ymd(to),page,size; page=cursor.page or 1; size=limit or 50; cursor bound to subject+sessionGeneration+operation+filters.
- Envelope/raw: data page wrapper data[].
- Ghi chú: Not a repayment ledger. Do not invent repayDate, repayAmt or adjRepayAmt; same composite key as current loans.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:1257; hash trong manifest.
- Test cần viết: `REQ-loans.history`, `RAW-loans.history`, `DTO-loans.history`, `SCOPE-loans.history`, `PAGE-loans.history`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `accountNo` | `items[].accountRef` | opaque-reference |
| `acctNo` | `items[].loanId` | identifier |
| `lndDate` | `items[].loanDate` | source-date |
| `expDate` | `items[].expiryDate` | source-date |
| `initialDebt` | `initialDebt` | VND-source |
| `remainingDebt` | `remainingDebt` | VND-source |
| `sumInt` | `sumInt` | VND-source |
| `totalDueAmount` | `totalDueAmount` | VND-source |

## loans.repayments

- **Release 10/10/2026: bật.** 32 field (3 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_loan_records`; `POST /prod/v2/sha-service/e/asset/debt-info/history`.
- Input bắt buộc: operation, repayFrom, repayTo. Input được phép: operation, brokerRef, accountRefs, loanFrom, loanTo, expiryFrom, expiryTo, repayFrom, repayTo, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body remNo=B.code,accounts=resolved accountRefs,fromLndDate/toLndDate=loan pair,fromExpDate/toExpDate=expiry pair,fromRepayDate/toRepayDate=repay pair (all ymd); fromInitialDebt,toInitialDebt,fromAdjRepayAmt,toAdjRepayAmt,mnId,lndTp=null after fixture; page=cursor.page or 1; size=limit or 50; cursor bound to subject+sessionGeneration+operation+filters.
- Envelope/raw: data page wrapper data[].
- Ghi chú: Repayment-period required for bounded report. Do not merge this with loan history under guessed field aliases.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:1208; hash trong manifest.
- Test cần viết: `REQ-loans.repayments`, `RAW-loans.repayments`, `DTO-loans.repayments`, `SCOPE-loans.repayments`, `PAGE-loans.repayments`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `accountNo` | `items[].accountRef` | opaque-reference |
| `acctNo` | `items[].loanId` | identifier |
| `lndDate` | `lndDate` | source-date |
| `repayDate` | `repayDate` | source-date |
| `initialDebt` | `initialDebt` | VND-source |
| `repayAmt` | `repayAmt` | VND-source |
| `remainingDebt` | `remainingDebt` | VND-source |
| `adjRepayAmt` | `adjRepayAmt` | VND-source |
| `lndInt` | `lndInt` | VND-source |
| `dlyInt` | `dlyInt` | VND-source |
| `lndCmsn` | `lndCmsn` | VND-source |
| `dlyCmsn` | `dlyCmsn` | VND-source |
| `intRt1` | `intRt1` | unverified |
| `intRt2` | `intRt2` | unverified |

## orders.history

- **Release 10/10/2026: bật.** 40 field (2 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_order_records`; `POST /prod/v2/sha-service/e/order/histories`.
- Input bắt buộc: operation, mode. Input được phép: operation, brokerRef, accountRefs, symbols, mode, from, to, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body brokerCodes=[B.code],accountNumbers=resolved accountRefs,stockCodes=symbols or [],page,pageSize=limit or 50; mode=history: fromDateTrades/toDateTrades=ymd dates,ordType:[],mdmType:[],ordStatus:[]; mode=today: type:0,ordStatus:['0','2','1','4','3','5','6'],omit date fields; cursor resolves page.
- Envelope/raw: data {pageNo,pageSize,totalCount,totalPage,content[]}.
- Ghi chú: mode=history requires from/to; today forbids them. Null differs by mode; do not globally map null to empty. ordNo not globally unique or globally ordered. Price scaling verified per instrument.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:517; hash trong manifest.
- Test cần viết: `REQ-orders.history`, `RAW-orders.history`, `DTO-orders.history`, `SCOPE-orders.history`, `PAGE-orders.history`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `content[].ordNo` | `items[].orderId` | identifier |
| `content[].accountNumber` | `items[].accountRef` | opaque-reference |
| `content[].dateTrades` | `items[].tradeDate` | source-date |
| `content[].stockCode` | `items[].symbol` | symbol |
| `content[].orderPrice` | `items[].orderPrice` | kVND-source |
| `content[].matchedPrice` | `items[].matchedPrice` | kVND-source |
| `content[].orderVolume` | `content[].orderVolume` | security-units |
| `content[].matchedVolume` | `content[].matchedVolume` | security-units |
| `content[].mthAmt` | `items[].matchedValue` | VND-source |
| `content[].revenueFee` | `content[].revenueFee` | VND-source |
| `content[].stockExFee` | `content[].stockExFee` | VND-source |
| `content[].netTransactionFee` | `content[].netTransactionFee` | VND-source |
| `content[].tradeStatus` | `content[].tradeStatus` | raw-enum |

## orders.unconfirmed

- **Release 10/10/2026: bật.** 19 field (2 field sau profile.pii); bằng chứng: live-shape-2026-10-10. pageSize cố định 30 (live: 5 bị từ chối "Invalid parameter pageSize"); giá/khối lượng vi-VN, đơn vị đồng. Đơn vị số liệu gắn status unverified.
- Tool: `get_order_records`; `POST /prod/v2/sha-service/e/order/list-confirm`.
- Input bắt buộc: operation, from, to. Input được phép: operation, from, to, cursor, limit; field khác bị từ chối.
- Request: body fromDate=ymd(from),toDate=ymd(to),emNo=verified preferredUsername in evidenced format,page,pageSize; no model-provided emNo; cursor resolves page.
- Envelope/raw: data page wrapper content[].
- Ghi chú: Read pending confirmation only; never confirms orders. Parse vi-VN formatting explicitly. N is a raw status, not numeric histories code. emNo missing in Swagger => wire verification gate.
- Gate: **G2-identity-binding**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:615; hash trong manifest.
- Test cần viết: `REQ-orders.unconfirmed`, `RAW-orders.unconfirmed`, `DTO-orders.unconfirmed`, `SCOPE-orders.unconfirmed`, `PAGE-orders.unconfirmed`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `content[].ordNo` | `items[].orderId` | identifier |
| `content[].accountNumber` | `items[].accountRef` | opaque-reference |
| `content[].code` | `items[].symbol` | symbol |
| `content[].orderPrice` | `content[].orderPrice` | VND-localized-source |
| `content[].matchedPrice` | `content[].matchedPrice` | VND-localized-source |
| `content[].orderVolume` | `content[].orderVolume` | localized-quantity |
| `content[].matchedVolume` | `content[].matchedVolume` | localized-quantity |
| `content[].tradeStatus` | `content[].tradeStatus` | raw-enum |
| `content[].dateTrades` | `content[].dateTrades` | source-date |

## orderSummary.account

- **Release 10/10/2026: bật.** 8 field (0 field sau profile.pii); bằng chứng: doc-only-live-sample-null. Đơn vị số liệu gắn status unverified.
- Tool: `get_order_summary`; `GET /prod/v2/sha-service/e/order/order-account-summary`.
- Input bắt buộc: operation, accountRef, subaccountRef. Input được phép: operation, accountRef, subaccountRef; field khác bị từ chối.
- Request: query accountNo=resolve(accountRef).accountNo; afAccountNo=resolve(subaccountRef).subId; assert subaccount belongs to account; subId=resolved subId; body=none.
- Envelope/raw: Historical doc null; report.js maps object.
- Ghi chú: Do not invent sum* fields from old doc. report.js maps depositoryFee to pitTax but semantics conflict with name; keep unknown until reconciliation.
- Gate: **G2-nonempty-and-semantics**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:655; hash trong manifest.
- Test cần viết: `REQ-orderSummary.account`, `RAW-orderSummary.account`, `DTO-orderSummary.account`, `SCOPE-orderSummary.account`, `PAGE-orderSummary.account`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `totalTransactionValue` | `transactionValue` | VND-source |
| `revenueFee` | `revenueFee` | VND-source |
| `stockExchangeFee` | `stockExchangeFee` | VND-source |
| `otherFees` | `otherFees` | VND-source |
| `buyTransactionValue` | `buyTransactionValue` | VND-source |
| `sellTransactionValue` | `sellTransactionValue` | VND-source |
| `depositoryFee` | `depositoryFeeRaw` | unverified |
| `netTransactionFee` | `netTransactionFee` | VND-source |

## orderSummary.confirmations

- **Release 10/10/2026: bật.** 7 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_order_summary`; `GET /prod/v2/sha-service/e/order/order-confirm-summary`.
- Input bắt buộc: operation. Input được phép: operation; field khác bị từ chối.
- Request: query remNo=verified preferredUsername per historical doc (NOT brokerCode); body=none; binding must be verified.
- Envelope/raw: data object.
- Ghi chú: Same parameter name remNo has a different identity domain here. Prevent accidental global broker rule.
- Gate: **G2-identity-binding**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:661; hash trong manifest.
- Test cần viết: `REQ-orderSummary.confirmations`, `RAW-orderSummary.confirmations`, `DTO-orderSummary.confirmations`, `SCOPE-orderSummary.confirmations`, `PAGE-orderSummary.confirmations`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `unCfmOrders` | `unconfirmed` | count |
| `cfmOrders` | `confirmed` | count |
| `buyOrders` | `buyOrders` | count |
| `sellOrders` | `sellOrders` | count |
| `sumCustomers` | `sumCustomers` | count |
| `ratio1` | `ratio1` | unverified |
| `ratio2` | `ratio2` | unverified |

## orderSummary.top

- **Release 10/10/2026: tắt.** live 10/10/2026 data [] (2 lần probe); chưa có shape.
- Tool: `get_order_summary`; `GET /prod/v2/sha-service/e/order/summary`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; query remNo=B.code; body=none.
- Envelope/raw: Only data:[] evidenced.
- Ghi chú: Hold until a nonempty record proves schema, ordering and metric meanings.
- Gate: **G2-nonempty-shape**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:669; hash trong manifest.
- Test cần viết: `REQ-orderSummary.top`, `RAW-orderSummary.top`, `DTO-orderSummary.top`, `SCOPE-orderSummary.top`, `PAGE-orderSummary.top`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `data` | `items` | unverified |

## orderSummary.transactions

- **Release 10/10/2026: bật.** 9 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. tổng trong ngày; ngoài giờ giao dịch mọi tổng null → SOURCE_NULL; dòng chi tiết chưa có shape nên bỏ. Đơn vị số liệu gắn status unverified.
- Tool: `get_order_summary`; `POST /prod/v2/sha-service/e/order/sum-transaction`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef, accountRefs, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; query page,size; body brokerCode=[B.code],accountNumbers=resolved accountRefs,valueFilterInfo={}; page=cursor.page or 1; size=limit or 50; cursor bound to subject+sessionGeneration+operation+filters.
- Envelope/raw: data page wrapper data[].
- Ghi chú: brokerCode is ARRAY here. page/size go in query. Report period not proven by empty valueFilterInfo => report period unknown; no invented date filters.
- Gate: **G2-report-period**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:1265; hash trong manifest.
- Test cần viết: `REQ-orderSummary.transactions`, `RAW-orderSummary.transactions`, `DTO-orderSummary.transactions`, `SCOPE-orderSummary.transactions`, `PAGE-orderSummary.transactions`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `sumAccounts` | `totals.accounts` | count |
| `sumTranValue` | `totals.transactionValue` | VND-source |
| `sumBuyValue` | `totals.buyValue` | VND-source |
| `sumSellValue` | `totals.sellValue` | VND-source |
| `sumRevenueFee` | `totals.revenueFee` | VND-source |
| `sumFcmCmsn` | `sumFcmCmsn` | VND-source |
| `sumSbTax` | `sumSbTax` | VND-source |
| `sumNetFee` | `sumNetFee` | VND-source |
| `sumSbFee` | `sumSbFee` | VND-source |
| `data` | `items` | nested-mapped |

## buyingPower.preview

- **Release 10/10/2026: bật.** 8 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. probe --extra: chỉ tính sức mua (order/balance), không tạo lệnh; price là chuỗi VND. Đơn vị số liệu gắn status unverified.
- Tool: `get_buying_power`; `POST /prod/v2/sha-service/e/order/balance`.
- Input bắt buộc: operation, accountRef, subaccountRef, symbol, price. Input được phép: operation, accountRef, subaccountRef, symbol, price; field khác bị từ chối.
- Request: body subNo=resolved subId,stkCd=symbol,ordPri=price string in VERIFIED upstream unit; accountRef is authorization context only.
- Envelope/raw: data object.
- Ghi chú: No order is created. Negative loan_total is allowed. Block until ordPri unit and side-effect-free behavior confirmed.
- Gate: **G2-input-price-unit**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:632; hash trong manifest.
- Test cần viết: `REQ-buyingPower.preview`, `RAW-buyingPower.preview`, `DTO-buyingPower.preview`, `SCOPE-buyingPower.preview`, `PAGE-buyingPower.preview`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `ppo` | `ppo` | unverified |
| `buy_abl_qty` | `buyableQuantity` | security-units |
| `buying_power` | `buyingPower` | VND-source |
| `room_qty` | `roomQuantity` | security-units |
| `sell_able_qty` | `sellableQuantity` | security-units |
| `loan_total` | `loanTotal` | VND-source |
| `gst_dpo` | `gst_dpo` | unverified |

## cash.movements

- **Release 10/10/2026: bật.** 15 field (3 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_cash_movements`; `POST /prod/v2/sha-service/e/account/deposit-withdrawal-info`.
- Input bắt buộc: operation, from, to. Input được phép: operation, brokerRef, accountRefs, from, to, direction, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body brokerCode=B.code,accounts=resolved accountRefs or null for explicit authorized broker scope,fromDate=ymd(from),toDate=ymd(to),status=null,transTp=deposit:'1'/withdrawal:'2'/all:null,type='[Perfomance] load deposit-withdrawal info',page,size; page=cursor.page or 1; size=limit or 50; cursor bound to subject+sessionGeneration+operation+filters.
- Envelope/raw: data page wrapper data[] with global aggregates.
- Ghi chú: Preserve typo Perfomance literal. Account counts are distinct accounts, not row counts. accountNo:null rows only in permitted broker report, never an account-filtered response.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:1184; hash trong manifest.
- Test cần viết: `REQ-cash.movements`, `RAW-cash.movements`, `DTO-cash.movements`, `SCOPE-cash.movements`, `PAGE-cash.movements`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `dpsAccCnt` | `totals.depositAccounts` | count |
| `wthDrwAccCnt` | `totals.withdrawalAccounts` | count |
| `dpsAmtTotal` | `totals.deposits` | VND-source |
| `wthDrwAmtTotal` | `totals.withdrawals` | VND-source |
| `data[].accountNo` | `items[].accountRef` | opaque-reference |
| `data[].amount` | `data[].amount` | VND-source |
| `data[].transDate` | `data[].transDate` | source-date |
| `data[].transTime` | `data[].transTime` | source-time |
| `data[].transTp` | `items[].direction` | raw-enum |
| `data[].status` | `data[].status` | raw-enum |

## newAccounts.report

- **Release 10/10/2026: bật.** 3 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_new_accounts_report`; `POST /prod/v2/sha-service/e/performance/open-new-account`.
- Input bắt buộc: operation, from, to. Input được phép: operation, brokerRef, from, to, cursor, limit; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body brokerCode=B.code,fromActDate=ymd(from),toActDate=ymd(to),statAcc=null,custid=authorized subtree codes per current revenue_sync_agent.js,page,size; page=cursor.page or 1; size=limit or 50; cursor bound to subject+sessionGeneration+operation+filters.
- Envelope/raw: data page wrapper data[].
- Ghi chú: Read new-account report; does NOT create accounts. Current code custid conflicts Swagger mnId. Confirm fields/activation definitions before exposing; current NAV>0 heuristic is not historical activation fact.
- Gate: **G2-custid-mnId**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:939; hash trong manifest.
- Test cần viết: `REQ-newAccounts.report`, `RAW-newAccounts.report`, `DTO-newAccounts.report`, `SCOPE-newAccounts.report`, `PAGE-newAccounts.report`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `sumAcc` | `totals.accounts` | count |
| `activeAccCnt` | `totals.active` | count |
| `inactiveAccCnt` | `totals.inactive` | count |
| `data` | `items` | nested-mapped |

## research.summary

- **Release 10/10/2026: bật.** 4 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_research`; `POST /prod/v2/sha-advice/e/dashboard/info-advice`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body brokerCodes=[B.code].
- Envelope/raw: data object.
- Ghi chú: Counts of research/advice items, not monetary amounts despite Amount names.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:875; hash trong manifest.
- Test cần viết: `REQ-research.summary`, `RAW-research.summary`, `DTO-research.summary`, `SCOPE-research.summary`, `PAGE-research.summary`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `totalAmount` | `total` | count |
| `totalAmountOpen` | `open` | count |
| `totalAmountClose` | `closed` | count |
| `totalAmountFollowing` | `following` | count |

## research.list

- **Release 10/10/2026: bật.** 13 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_research`; `POST /prod/v2/sha-advice/e/get-all`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef, search; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body brokerCodes=[B.code],searchValue=search or '',tag='ALL'.
- Envelope/raw: data array; no proven pagination.
- Ghi chú: Upstream research is untrusted text/data. Omit recommendToPersonal and recipients by default. No edit/follow operation.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:883; hash trong manifest.
- Test cần viết: `REQ-research.list`, `RAW-research.list`, `DTO-research.list`, `SCOPE-research.list`, `PAGE-research.list`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `id` | `items[].id` | identifier |
| `stockCode` | `items[].symbol` | symbol |
| `marketCode` | `marketCode` | identifier |
| `recommendDate` | `recommendDate` | source-date |
| `status` | `status` | raw-enum |
| `recommendPrice.from` | `recommendPrice.from` | unverified |
| `recommendPrice.to` | `recommendPrice.to` | unverified |
| `targetPrice.from` | `targetPrice.from` | unverified |
| `targetPrice.to` | `targetPrice.to` | unverified |
| `lossPrice` | `lossPrice` | unverified |
| `potential` | `potential` | unverified |
| `holdingPeriod` | `holdingPeriod` | unverified |

## groups.list

- **Release 10/10/2026: bật.** 11 field (2 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `list_customer_groups`; `POST /prod/v2/sha-customer/e/customer-group/get-all-group-customer`.
- Input bắt buộc: operation. Input được phép: operation, brokerRef, accountRefs, search; field khác bị từ chối.
- Request: B=authorized broker selected by brokerRef; brokerRef absent only when one root is unambiguous; body brokerCodes=[B.code],accountNumbers=resolved accountRefs or [],searchValue=search or ''.
- Envelope/raw: data array; members[].
- Ghi chú: Group membership is read-only; each member filtered/validated against entitlements, no group writes.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:909; hash trong manifest.
- Test cần viết: `REQ-groups.list`, `RAW-groups.list`, `DTO-groups.list`, `SCOPE-groups.list`, `PAGE-groups.list`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `id` | `items[].groupId` | identifier |
| `name` | `items[].name` | text |
| `brokerCode` | `brokerCode` | identifier |
| `isActive` | `isActive` | boolean |
| `groupCode` | `groupCode` | identifier |
| `members[].accountNo` | `members[].accountRef` | opaque-reference |
| `members[].name` | `members[].customerDisplay` | masked-text |
| `members[].isActive` | `members[].isActive` | boolean |

## market.catalog

- **Release 10/10/2026: bật.** 4 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_sha_market_data`; `GET /prod/v2/sha-service/e/market/get-stock-codes`.
- Input bắt buộc: operation. Input được phép: operation; field khác bị từ chối.
- Request: query=none; body=none.
- Envelope/raw: data array.
- Ghi chú: Aliases such as _WFT may exist. Do not claim full universe or silently discard aliases.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:809; hash trong manifest.
- Test cần viết: `REQ-market.catalog`, `RAW-market.catalog`, `DTO-market.catalog`, `SCOPE-market.catalog`, `PAGE-market.catalog`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `id` | `items[].id` | identifier |
| `shortName` | `items[].symbol` | symbol |
| `name` | `name` | text |
| `stock` | `stock` | unverified |

## market.quote

- **Release 10/10/2026: bật.** 21 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_sha_market_data`; `POST /prod/v2/sha-service/e/market/stock/code`.
- Input bắt buộc: operation, symbol. Input được phép: operation, symbol; field khác bị từ chối.
- Request: body stk_cd=symbol.
- Envelope/raw: data array.
- Ghi chú: Validate symbol response; price/volume units independent of SHSmart. Request-time snapshot, not streaming.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:816; hash trong manifest.
- Test cần viết: `REQ-market.quote`, `RAW-market.quote`, `DTO-market.quote`, `SCOPE-market.quote`, `PAGE-market.quote`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `code` | `symbol` | symbol |
| `last` | `last` | unverified |
| `ref_price` | `referencePrice` | unverified |
| `ceiling` | `ceiling` | unverified |
| `floor` | `floor` | unverified |
| `open` | `open` | unverified |
| `high` | `high` | unverified |
| `low` | `low` | unverified |
| `volume` | `volume` | security-units |
| `change_rate` | `changeRate` | unverified |
| `bid_offer_list[].bid` | `bid_offer_list[].bid` | unverified |
| `bid_offer_list[].offer` | `bid_offer_list[].offer` | unverified |
| `bid_offer_list[].bid_size` | `bid_offer_list[].bid_size` | unverified |
| `bid_offer_list[].offer_size` | `bid_offer_list[].offer_size` | unverified |

## market.price

- **Release 10/10/2026: bật.** 24 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_sha_market_data`; `GET /prod/v2/sha-service/e/market/securities-price`.
- Input bắt buộc: operation, symbol. Input được phép: operation, symbol; field khác bị từ chối.
- Request: query securities=symbol; body=none.
- Envelope/raw: data object/array must be fixed by fixture.
- Ghi chú: No source timestamp observed => sourceTimestamp=null, fetchedAt remains transport time.
- Gate: **G2-variant-shape**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:1177; hash trong manifest.
- Test cần viết: `REQ-market.price`, `RAW-market.price`, `DTO-market.price`, `SCOPE-market.price`, `PAGE-market.price`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `code` | `symbol` | symbol |
| `last` | `last` | unverified |
| `change` | `change` | unverified |
| `change_rate` | `changeRate` | unverified |
| `ref_price` | `referencePrice` | unverified |
| `avg_price` | `averagePrice` | unverified |
| `ceiling` | `ceiling` | unverified |
| `floor` | `floor` | unverified |

## market.ticks

- **Release 10/10/2026: bật.** 13 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. Đơn vị số liệu gắn status unverified.
- Tool: `get_sha_market_data`; `GET /prod/v2/sha-system/e/trading/stock-quote-list`.
- Input bắt buộc: operation, symbol. Input được phép: operation, symbol, limit; field khác bị từ chối.
- Request: query symbol=symbol,fetchCount=limit or 50; body=none.
- Envelope/raw: SHA envelope data {lastIndex,lastSize,data:tick[]}.
- Ghi chú: No websocket. lastIndex does not prove a usable cursor. Time string format requires timezone/date proof before sourceTimestamp conversion.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:837; hash trong manifest.
- Test cần viết: `REQ-market.ticks`, `RAW-market.ticks`, `DTO-market.ticks`, `SCOPE-market.ticks`, `PAGE-market.ticks`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `data[].ti` | `items[].sourceTimeRaw` | source-time |
| `data[].mb` | `items[].side` | raw-enum |
| `data[].mv` | `items[].quantity` | unverified |
| `data[].c` | `items[].price` | unverified |
| `data[].vo` | `items[].cumulativeVolume` | unverified |
| `data[].va` | `items[].cumulativeValue` | unverified |
| `lastIndex` | `lastIndex` | identifier |
| `lastSize` | `lastSize` | count |

## market.candles

- **Release 10/10/2026: bật.** 8 field (0 field sau profile.pii); bằng chứng: source-described-not-live-verified, semantic-or-unit-verification-required. Đơn vị số liệu gắn status unverified.
- Tool: `get_sha_market_data`; `GET /prod/v2/advisor-service/e/market/tradingview/history`.
- Input bắt buộc: operation, symbol, resolution, fromTime, toTime. Input được phép: operation, symbol, resolution, fromTime, toTime; field khác bị từ chối.
- Request: query symbol=symbol,resolution=1D,from=epochSeconds(fromTime),to=epochSeconds(toTime); body=none.
- Envelope/raw: Flat TradingView UDF, no SHA code envelope.
- Ghi chú: Equal array lengths, chronological unique bars; validate s=ok/no_data/error and nextTime. No adjusted-return claim.
- Gate: **G2-contract**, cộng G0/G1 và test scope chung.
- Nguồn: docs/api/api-documentation.md:855; hash trong manifest.
- Test cần viết: `REQ-market.candles`, `RAW-market.candles`, `DTO-market.candles`, `SCOPE-market.candles`, `PAGE-market.candles`; chưa chạy.

| Raw field (sau data envelope) | DTO | Unit/ý nghĩa dự kiến |
|---|---|---|
| `t[]` | `items[].time` | epoch-seconds |
| `o[]` | `items[].open` | unverified |
| `h[]` | `items[].high` | unverified |
| `l[]` | `items[].low` | unverified |
| `c[]` | `items[].close` | unverified |
| `v[]` | `items[].volume` | unverified |
| `s` | `status` | raw-enum |
| `nextTime` | `nextTime` | epoch-seconds |

## knowledge.departments

- **Release 10/10/2026: bật.** 8 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. KMS Strapi {data, meta.pagination}; 6 phòng ban live. Đơn vị số liệu gắn status unverified.
- Tool: `get_knowledge_library`; `GET /prod/v2/sha-service/e/forward/cms/departments`. Nguồn: SHA_PC src/preload/kms_library.js:25 @7261a8d.
- Danh sách phòng ban của kho tri thức KMS; mã phòng dùng cho knowledge.documents.

## knowledge.documents

- **Release 10/10/2026: bật.** 14 field (0 field sau profile.pii); bằng chứng: live-shape-2026-10-10. KMS; mã phòng phải nằm trong danh sách live; Content là văn bản không tin cậy, cắt 4000 ký tự; phân trang meta.pagination. Đơn vị số liệu gắn status unverified.
- Tool: `get_knowledge_library`; `GET /prod/v2/sha-service/e/forward/cms/knowledge-shares/department/{department}`; query keyword, pageSize, page.
- Mã phòng ban kiểm theo mẫu và phải có trong danh sách phòng ban live; nội dung là dữ liệu không tin cậy.

