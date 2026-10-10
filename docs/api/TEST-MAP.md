# Ma trận kiểm thử operation

Tất cả test bên dưới có trạng thái **PLANNED**, không phải kết quả passed. Mỗi test ID phải trở thành test thực trong tests/ trước khi operation được bật. Xem [TEST-PLAN](../TEST-PLAN.md) để biết assertions bắt buộc.

Checkpoint runtime: tests/contracts.test.ts có assertions đại diện REQ-A/B, orders/date và DTO/coverage; tests/security.test.ts và tests/oauth.test.ts kiểm platform chung. Release 10/10/2026: 34 operation bật. accounts.tree có 5 suite riêng (tests/accounts-tree.test.ts); 33 operation dùng projection fieldMap có test bảng REQ/RAW/DTO/SCOPE/PAGE trong tests/released-operations.test.ts (fixture tổng hợp sinh từ fieldMap, fieldMap sinh từ shape live); market.candles dùng RAW-market.candles trong contracts.test.ts. Tất cả passed 10/10/2026. 6 operation còn tắt giữ PLANNED. Coverage thực xem [VALIDATION](../VALIDATION.md).

| Operation | Request | Raw/envelope | DTO/unit | Scope | Pagination/coverage |
|---|---|---|---|---|---|
| identity.current | REQ-identity.current | RAW-identity.current | DTO-identity.current | SCOPE-identity.current | PAGE-identity.current |
| accounts.tree | REQ-accounts.tree | RAW-accounts.tree | DTO-accounts.tree | SCOPE-accounts.tree | PAGE-accounts.tree |
| accounts.search | REQ-accounts.search | RAW-accounts.search | DTO-accounts.search | SCOPE-accounts.search | PAGE-accounts.search |
| accounts.subaccounts | REQ-accounts.subaccounts | RAW-accounts.subaccounts | DTO-accounts.subaccounts | SCOPE-accounts.subaccounts | PAGE-accounts.subaccounts |
| profile.detail | REQ-profile.detail | RAW-profile.detail | DTO-profile.detail | SCOPE-profile.detail | PAGE-profile.detail |
| profile.information | REQ-profile.information | RAW-profile.information | DTO-profile.information | SCOPE-profile.information | PAGE-profile.information |
| profile.authorized | REQ-profile.authorized | RAW-profile.authorized | DTO-profile.authorized | SCOPE-profile.authorized | PAGE-profile.authorized |
| customers.overview | REQ-customers.overview | RAW-customers.overview | DTO-customers.overview | SCOPE-customers.overview | PAGE-customers.overview |
| assets.cash | REQ-assets.cash | RAW-assets.cash | DTO-assets.cash | SCOPE-assets.cash | PAGE-assets.cash |
| assets.stockValue | REQ-assets.stockValue | RAW-assets.stockValue | DTO-assets.stockValue | SCOPE-assets.stockValue | PAGE-assets.stockValue |
| assets.margin | REQ-assets.margin | RAW-assets.margin | DTO-assets.margin | SCOPE-assets.margin | PAGE-assets.margin |
| assets.loanSummary | REQ-assets.loanSummary | RAW-assets.loanSummary | DTO-assets.loanSummary | SCOPE-assets.loanSummary | PAGE-assets.loanSummary |
| assets.loanDetail | REQ-assets.loanDetail | RAW-assets.loanDetail | DTO-assets.loanDetail | SCOPE-assets.loanDetail | PAGE-assets.loanDetail |
| portfolio.account | REQ-portfolio.account | RAW-portfolio.account | DTO-portfolio.account | SCOPE-portfolio.account | PAGE-portfolio.account |
| brokerAssets.summary | REQ-brokerAssets.summary | RAW-brokerAssets.summary | DTO-brokerAssets.summary | SCOPE-brokerAssets.summary | PAGE-brokerAssets.summary |
| brokerAssets.accounts | REQ-brokerAssets.accounts | RAW-brokerAssets.accounts | DTO-brokerAssets.accounts | SCOPE-brokerAssets.accounts | PAGE-brokerAssets.accounts |
| brokerAssets.cash | REQ-brokerAssets.cash | RAW-brokerAssets.cash | DTO-brokerAssets.cash | SCOPE-brokerAssets.cash | PAGE-brokerAssets.cash |
| brokerAssets.portfolio | REQ-brokerAssets.portfolio | RAW-brokerAssets.portfolio | DTO-brokerAssets.portfolio | SCOPE-brokerAssets.portfolio | PAGE-brokerAssets.portfolio |
| credit.guarantees | REQ-credit.guarantees | RAW-credit.guarantees | DTO-credit.guarantees | SCOPE-credit.guarantees | PAGE-credit.guarantees |
| credit.collateral | REQ-credit.collateral | RAW-credit.collateral | DTO-credit.collateral | SCOPE-credit.collateral | PAGE-credit.collateral |
| loans.current | REQ-loans.current | RAW-loans.current | DTO-loans.current | SCOPE-loans.current | PAGE-loans.current |
| loans.history | REQ-loans.history | RAW-loans.history | DTO-loans.history | SCOPE-loans.history | PAGE-loans.history |
| loans.repayments | REQ-loans.repayments | RAW-loans.repayments | DTO-loans.repayments | SCOPE-loans.repayments | PAGE-loans.repayments |
| orders.history | REQ-orders.history | RAW-orders.history | DTO-orders.history | SCOPE-orders.history | PAGE-orders.history |
| orders.unconfirmed | REQ-orders.unconfirmed | RAW-orders.unconfirmed | DTO-orders.unconfirmed | SCOPE-orders.unconfirmed | PAGE-orders.unconfirmed |
| orderSummary.account | REQ-orderSummary.account | RAW-orderSummary.account | DTO-orderSummary.account | SCOPE-orderSummary.account | PAGE-orderSummary.account |
| orderSummary.confirmations | REQ-orderSummary.confirmations | RAW-orderSummary.confirmations | DTO-orderSummary.confirmations | SCOPE-orderSummary.confirmations | PAGE-orderSummary.confirmations |
| orderSummary.top | REQ-orderSummary.top | RAW-orderSummary.top | DTO-orderSummary.top | SCOPE-orderSummary.top | PAGE-orderSummary.top |
| orderSummary.transactions | REQ-orderSummary.transactions | RAW-orderSummary.transactions | DTO-orderSummary.transactions | SCOPE-orderSummary.transactions | PAGE-orderSummary.transactions |
| buyingPower.preview | REQ-buyingPower.preview | RAW-buyingPower.preview | DTO-buyingPower.preview | SCOPE-buyingPower.preview | PAGE-buyingPower.preview |
| cash.movements | REQ-cash.movements | RAW-cash.movements | DTO-cash.movements | SCOPE-cash.movements | PAGE-cash.movements |
| newAccounts.report | REQ-newAccounts.report | RAW-newAccounts.report | DTO-newAccounts.report | SCOPE-newAccounts.report | PAGE-newAccounts.report |
| research.summary | REQ-research.summary | RAW-research.summary | DTO-research.summary | SCOPE-research.summary | PAGE-research.summary |
| research.list | REQ-research.list | RAW-research.list | DTO-research.list | SCOPE-research.list | PAGE-research.list |
| groups.list | REQ-groups.list | RAW-groups.list | DTO-groups.list | SCOPE-groups.list | PAGE-groups.list |
| market.catalog | REQ-market.catalog | RAW-market.catalog | DTO-market.catalog | SCOPE-market.catalog | PAGE-market.catalog |
| market.quote | REQ-market.quote | RAW-market.quote | DTO-market.quote | SCOPE-market.quote | PAGE-market.quote |
| market.price | REQ-market.price | RAW-market.price | DTO-market.price | SCOPE-market.price | PAGE-market.price |
| market.ticks | REQ-market.ticks | RAW-market.ticks | DTO-market.ticks | SCOPE-market.ticks | PAGE-market.ticks |
| market.candles | REQ-market.candles | RAW-market.candles | DTO-market.candles | SCOPE-market.candles | PAGE-market.candles |
| knowledge.departments | REQ-knowledge.departments | RAW-knowledge.departments | DTO-knowledge.departments | SCOPE-knowledge.departments | PAGE-knowledge.departments |
| knowledge.documents | REQ-knowledge.documents | RAW-knowledge.documents | DTO-knowledge.documents | SCOPE-knowledge.documents | PAGE-knowledge.documents |
