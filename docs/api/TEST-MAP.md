# Ma trận kiểm thử operation

Retry login local 12/10/2026, `tests/interactions.test.ts`: AUTH-FLOW-04 kiểm password bị từ chối → 303 → form/handle/CSRF mới → nhập đúng → OTP/consent/code trong cùng OAuth interaction; credential không lưu/echo/log, refresh/replay không gửi SHA. AUTH-FLOW-05 kiểm OTP bị từ chối/timeout/hết hạn, restart chủ động và loại bỏ challenge. AUTH-FLOW-06 kiểm quota người dùng giữ qua retry/interaction mới/ID đổi kiểu chữ. AUTH-FLOW-07 phân biệt allowlist/CSRF/client params; provider thiếu/store lỗi fail closed. AUTH-FLOW-08 kiểm GET và POST lặp khi request đầu đang xử lý không ghi đè flow hoặc gọi SHA thêm. Tổng 72 synthetic tests; không chứng minh retry live hoặc lý do FORBIDDEN_SCOPE ban đầu.

DICT-01..03 (`tests/dictionary.test.ts`): tách nghĩa theo operation, mã số/chữ, bằng chứng 4/5 chưa xác minh, unknown/leading-zero, nhãn nguồn, giới hạn kích thước metadata, path/provenance và độ phủ các trường status công khai. DICT-04 (`tests/released-operations.test.ts`): qua ReadService với upstream giả lập, mã 5/05/UNKNOWN/null/missing giữ nguyên, metadata có nhãn và mức bằng chứng, coverage/PII không đổi. DICT-SDK bổ sung vào test OAuth hiện có: client chỉ đọc text cũng nhận được bảng mã/dòng nguồn/hash qua metadata tool. Không dùng test synthetic để xác nhận nghĩa enum live.

MCP-TEXT-01 (11/10/2026), thêm assertions vào hai test SDK/OAuth hiện có trong `tests/oauth.test.ts`: client chỉ đọc text vẫn parse được metadata capabilities (39 operation và 3 candidate), dictionary, identity, accounts.tree và lỗi có requestId; JSON từ text bằng structuredContent. Kiểm tài khoản/tên khách có và không có profile.pii, null được giữ và bearer canary không lộ. Không cộng thành test suite mới vào tổng 63.

Regression cookie 11/10/2026, `tests/interactions.test.ts`: AUTH-FLOW-01 kiểm hai interaction chung browser, login/OTP/consent độc lập qua hai instance; AUTH-FLOW-02 kiểm cookie thiếu, provider cookie thiếu, flow hết hạn/sai UID, CSRF sai, double submit/replay chỉ gọi SHA begin một lần và log không chứa canary; AUTH-FLOW-03 kiểm cookie cũ chuyển sang cookie riêng. Đây là synthetic, không thay thế AUTH-09 về chính sách nhiều phiên SHA thật hoặc nghiệm thu Claude Android.

Kiểm thủ công GPT ngày 10/10/2026: `GPT-CONNECT-01` (DCR → login/OTP/consent → callback), `GPT-META-01` (list_profile_capabilities, get_profile_data_dictionary cho identity.current) và `GPT-PII-01` (accounts.tree qua kết nối xin profile.pii, người dùng tick consent; 8/8 accountNumber/customerName, brokerName riêng) đạt trên ChatGPT Work; OIDC tắt ở client. Đây là 3 ca manual, không cộng vào 60 synthetic tests, không đại diện toàn bộ nghiệp vụ/PII/vòng đời phiên. Chi tiết trong [VALIDATION](../VALIDATION.md).

Các ID bên dưới là ma trận thiết kế gồm 5 nhóm cho mỗi trong 42 operation (210 ID); bảng ID không tự chứng minh mọi assertion đã passed. Xem [TEST-PLAN](../TEST-PLAN.md) để biết assertions bắt buộc và [VALIDATION](../VALIDATION.md) để biết kết quả chạy thực.

Release 10/10/2026: 39/42 operation bật. accounts.tree có 5 test riêng (tests/accounts-tree.test.ts); 37 operation dùng projection fieldMap có test bảng REQ/RAW/DTO/SCOPE/PAGE trong tests/released-operations.test.ts (fixture synthetic sinh từ fieldMap, theo shape live hoặc doc-only khi mẫu live rỗng). market.candles có RAW-market.candles trong contracts.test.ts; 4 ID còn lại của candles vẫn là mục tiêu, chưa có suite riêng tương ứng. tests/contracts.test.ts còn có assertions đại diện REQ-A/B, orders/date và DTO/coverage; tests/security.test.ts và tests/oauth.test.ts kiểm platform chung. 3 operation tắt (profile.authorized, assets.loanDetail, orderSummary.top) giữ PLANNED. Kết quả chạy và giới hạn coverage xem [VALIDATION](../VALIDATION.md).

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
