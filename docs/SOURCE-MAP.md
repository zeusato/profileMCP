# Provenance và phạm vi tái sử dụng

## KMS local 15/10/2026

Không đọc/copy dữ liệu hoặc session từ SHA PC trong lượt sửa này. Dùng contract `Content`/`Photo.url` và source hash đã ghi ở phần 10/10 bên dưới. `src/knowledge.ts` là phép biến đổi DTO mới của Profile MCP: parse HTML, giữ text/media refs và phân phần; đây không phải field upstream mới. Config và generator giữ cùng mô tả trường Content. Kiểm chứng synthetic KMS-01..05/KMS-SDK tại TEST-MAP.

Parser: [parse5 official API](https://parse5.js.org/modules/parse5.html); `npm view parse5 version engines exports --json` ngày 15/10 trả 8.0.1, ESM export `./dist/index.js`. Pin `parse5=8.0.1` và transitive `entities=8.1.0` bằng package-lock (resolved npm registry + sha512 integrity); không chạy lifecycle scripts khi cài. Không suy test parser là nghiệm thu API KMS live.

Rà soát SHA PC tại `D:\Quyetnm\Dev\SHA PC`, commit `8363a1a1bec8b0d11251ff6f6830d6ea4f747306`, working tree sạch lúc kiểm. Manifest file/hash tại [source-manifest.json](../config/source-manifest.json). Các đường dẫn nguồn ghi ở đây là bằng chứng; bộ tài liệu mới tự chứa contract cần thiết, không cần checkout nguồn khi bắt đầu đọc plan.

Không copy file nguồn hoặc raw OpenAPI vào dự án mới. Nội dung catalog do tổng hợp/biên soạn từ request builder và tài liệu, loại bỏ examples chứa tài khoản/credentials. SHA PC không bị sửa và không chạy script từ repo nguồn.

| Nguồn | Dùng cho | Biến đổi dự kiến khi implementation |
|---|---|---|
| docs/api/api-documentation.md | 40 read method/path, 3 auth, 4 trading writes, fields | Viết typed adapters; doc cũ không tự là live evidence |
| docs/api/api-docs.json | 69 path/70 method-path discovery | Chỉ lấy method/path và phân loại; không tự map/bật Gateway |
| docs/api/api-transformation-guide.md | Prefix service/scope, refresh path mention | Canonical host/path allowlist; refresh disabled |
| src/preload/session_identity.js | get-user-login và token epoch fencing | Repository identity/scope riêng, không DOM/localStorage |
| src/preload/trade_pro_agent.js | Read account/assets/order requests và mode today | Chỉ port builder/parser đọc; bỏ hoàn toàn create/modify/cancel |
| src/preload/report.js | Field mapping assets/portfolio/transaction | Decimal/null strict; depositoryFee giữ gate semantic |
| src/preload/revenue_sync_agent.js | Broker subtree, paging, loan key, cash/new-account report | Bound pages/time, fail-closed scope, no Electron sync/SQLCipher |
| docs/api/sha-order-api-gotchas.md | Method/ID/status pitfalls | Giữ inferred/unknown labels; không sao chép write recipes/logs |
| docs/modules/dashboard-management-module.md | Phân biệt source metrics với derived dashboard | Không port KPI/config writes hoặc warehouse tính toán |
| dashboard-cashflow-newacct-module.md, dashboard-kpi-performance-module.md | Ngữ cảnh báo cáo | Không coi mỗi chart là API có sẵn |
| src/main/modules/auth_session.js, account_ipc.js | Hiểu môi trường auth Electron | Không port token interception/credential storage |

Line numbers trong catalog trỏ heading lịch sử để tìm contract, không cam kết mọi field được chứng minh cùng một dòng. Hash file khóa snapshot để phát hiện nguồn đổi. Khi port code thật, bổ sung mapping source symbol/line → destination file/function → biến đổi → test, không chỉ giữ bảng kế hoạch này.

Không đưa source `docs/api-new-endpoints.md` vào manifest vì file được liên kết nhưng thiếu trong checkout. Source live-probe claims lịch sử không được ghi passed trong validation của Profile MCP.

Quét literal Gateway path trong toàn bộ `src/**/*.js` và `src/**/*.ts` tìm được **37 path khác nhau**, xem [code-route-inventory.json](../config/code-route-inventory.json). Các path ngoài baseline chỉ gồm login-v2, 4 trading writes và wildcard forward/cms bị loại; không phát hiện literal read path riêng khác chưa được phân loại. Đây là kiểm độ phủ tĩnh, không chứng minh mọi request động hoặc method đã được quan sát. Các candidate chỉ có tài liệu vẫn phải qua G2.

## Tài liệu chính thức tham khảo ngày 09/10/2026

- [MCP Authorization 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization): OAuth resource authorization.
- [MCP security](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices): token passthrough, redirect/consent threats.
- [oidc-provider](https://github.com/panva/node-oidc-provider): đã chọn 9.12.2, two-instance synthetic flow passed và metadata production chạy; trạng thái client cập nhật 10/10 tại HANDOFF/VALIDATION.
- [Supabase secure data](https://supabase.com/docs/guides/database/secure-data), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [serverless Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers): private store và kết nối backend.

Các quyết định TTL, schema, limits, grouping tool và policy trong bộ tài liệu là **thiết kế Profile MCP**, không gán nhầm thành tính năng/bảo đảm của SHA, Supabase hoặc Vercel.

## Mapping runtime cập nhật 10/10/2026

Không copy source code/credentials/fixtures thật. Runtime mới viết theo catalog/provenance đã hash ở trên.

| Contract/source đã hash | Destination | Biến đổi và kiểm chứng |
|---|---|---|
| Gateway auth contract, AUTH-AND-SESSIONS | src/sha/auth.ts, src/sha/transport.ts, src/interactions.ts | Browser-only, fixed host/3 routes, không refresh/retry; synthetic OAuth dùng fake gateway; login/OTP production đã kiểm với một tài khoản môi giới qua Claude |
| 42 route requestBinding/inputSchema trong config/sha-read-candidates.json | src/sha/catalog.ts, src/sha/requests.ts | Strict AJV, switch allowlist, scope server-derived; 39 route bật/đã gọi live qua Claude, 3 giữ disabled; tests/contracts.test.ts và tests/released-operations.test.ts, coverage chi tiết trong TEST-MAP |
| identity/tree theo session_identity và Gateway docs | src/policy.ts | Authoritative username/broker tree, HMAC subject/session/generation refs; synthetic cross-user/response drift assertions |
| fieldMap/unit trong catalog, report/revenue_sync contract | src/dto.ts, src/service.ts | Decimal/null/missing, whitelist, paging budget/repeated totals; fieldMap theo live-shapes hoặc doc-only khi mẫu rỗng, đơn vị vẫn unverified, PII khách hàng theo profile.pii |
| Kiến trúc Profile MCP (không SHA feature) | src/oauth.ts, src/store.ts, src/crypto.ts, migration 002 | Official library adapter, encrypted artifacts, atomic consume/quota/revoke, EXECUTE-only; tests/security.test.ts, tests/oauth.test.ts |
| MCP authorization/SDK chính thức | src/mcp.ts, src/app.ts, api/index.ts | Stateless Streamable HTTP, 401/discovery, 2 metadata + 18 business tools (schema gộp, mô tả), SDK integration test |

Callback được đối chiếu [OpenAI auth](https://developers.openai.com/plugins/build/auth), [Claude authentication](https://claude.com/docs/connectors/building/authentication). DCR/login/tools của Claude đã kiểm ngày 10/10; ChatGPT chưa nghiệm thu. CA TLS được đối chiếu source Supabase Studio; URL/fingerprint tại [database-ca-provenance.json](../config/database-ca-provenance.json). Native runtime dependencies pin trong package-lock.json.

## Bổ sung 10/10/2026 — SHA_PC @7261a8d và bằng chứng live

Đại ca chỉ nguồn D:\Dev\SHA_PC\SHA_PC_code (HEAD 7261a8dbf4ab9ba4cb086b869909b59579e8b417; working tree có file đang sửa, các file dưới không nằm trong số đó). Chỉ đọc; không chạy script, không đọc logs/output/tmp.

Kiểm lại ngày 10/10/2026 khi hoàn tất tài liệu: `git rev-parse HEAD` khớp commit trên, `git status --short -- <4 file dưới>` không có thay đổi, và `Get-FileHash -Algorithm SHA256` khớp cả 4 hash. Không copy nội dung nguồn, credential hoặc dữ liệu tài khoản.

| File | sha256 | Dùng cho |
|---|---|---|
| docs/api/api-documentation.md | a3eec0f16b1a4ac8959e0573dc201fa08009402075e6dbc5ac723c9bbe7ac618 | Danh mục 46 endpoint, field portfolio/guarantee/collateral (fieldMap doc-only), list-confirm emNo/định dạng, balance, sum-transaction, loan-info/history |
| src/preload/kms_library.js | bb50db4bc233da99d9af9b84ba23c27fbe6942ea68440dcce5cc4e818b0f0755 | KMS forward/cms departments + knowledge-shares/department/{code} |
| src/preload/dashboard_notice.js | 80641fdad1e9da8bfd80734ce7905300accf72000dda54d901ff084ddb73c0fb | Body cấp môi giới {brokerCode, page} của guarantee/collateral |
| src/preload/trade_pro_agent.js | a69374eb18afb262bc1babda8853ffff2dda816c16084a62290c9125763bcb38 | Body theo tiểu khoản {brokerCode, accounts, subId} của guarantee |

Bằng chứng live (không giá trị, chỉ tên field/kiểu): [live-shapes-20261010.json](../config/live-shapes-20261010.json) từ scripts/trace-sha-login.ts --live --probe [--extra] với tài khoản của Đại ca; DevTools web gốc sha.shs.com.vn do Đại ca chụp (Authorization: Bearer null, Session-Key) cho contract đăng nhập.

## Từ điển mã trạng thái 11/10/2026

Rà nguồn SHA_PC @7261a8dbf4ab9ba4cb086b869909b59579e8b417, chỉ đọc tài liệu/mã hiển thị. Không chạy source, không lấy logs, credentials hoặc dữ liệu tài khoản. Các file dưới không nằm trong danh sách sửa của source checkout khi bắt đầu rà; hash SHA256 khóa nội dung đã đọc.

| Nguồn | SHA256 |
|---|---|
| docs/api/api-documentation.md | a3eec0f16b1a4ac8959e0573dc201fa08009402075e6dbc5ac723c9bbe7ac618 |
| docs/api/sha-order-api-gotchas.md | 544c5afc9717fd5c6b07f61fe668a1e2c7c4c573b70dd0c07ac5c0513a435ca1 |
| src/preload/ai_chat.js | 7f7fad4b674ccd3b723ebd71a644e63704ce7ec768d5d4ae7fd03c35db988fce |
| src/preload/trade_pro.js | f0550aff6a49944005a04c779a5fb680d125cf9561b2f4c7eae8f07ca9fc333f |
| src/preload/dashboard_notice.js | 80641fdad1e9da8bfd80734ce7905300accf72000dda54d901ff084ddb73c0fb |
| src/shared/order_slip_model.js | bfe376737c431a4c6675ed4d628d9f6a1f3781b7943d01d205836c90b1bd22da |

Mapping chi tiết tới dòng nguồn nằm trong [sha-code-dictionary.json](../config/sha-code-dictionary.json): orders.history (API 602, AI chat 820), orders.unconfirmed (API 627), cash.movements (API 1181–1189), profile (AI chat 863–865, trade_pro 4019–4041), collateral (API 491, dashboard_notice 11–12), research (API 891/896, AI chat 127/143). Runtime [dictionary.ts](../src/dictionary.ts) dùng các mã chính xác theo operation/DTO field; [mcp.ts](../src/mcp.ts) xuất qua metadata tool, [service.ts](../src/service.ts) kèm meta.codeDictionary. DICT-01..04 và DICT-SDK kiểm mapping, mức bằng chứng, mã chưa biết, DTO không đổi và text/structuredContent.

Đây là provenance nguồn, không là nghiệm thu live enum của Profile MCP. Không nhận mapping sBoard/SHSmart/Fialda hoặc status nội bộ do dashboard tính. Riêng UDF candles.s là cờ giao thức do parser tiêu thụ (RAW-market.candles), không phải data.status được xuất cho model.
