# Provenance và phạm vi tái sử dụng

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
- [oidc-provider](https://github.com/panva/node-oidc-provider): đã chọn 9.12.2, two-instance synthetic flow passed và metadata production chạy; live client acceptance còn mở.
- [Supabase secure data](https://supabase.com/docs/guides/database/secure-data), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [serverless Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers): private store và kết nối backend.

Các quyết định TTL, schema, limits, grouping tool và policy trong bộ tài liệu là **thiết kế Profile MCP**, không gán nhầm thành tính năng/bảo đảm của SHA, Supabase hoặc Vercel.

## Mapping runtime tại checkpoint 09/10/2026

Không copy source code/credentials/fixtures thật. Runtime mới viết theo catalog/provenance đã hash ở trên.

| Contract/source đã hash | Destination | Biến đổi và kiểm chứng |
|---|---|---|
| Gateway auth contract, AUTH-AND-SESSIONS | src/sha/auth.ts, src/sha/transport.ts, src/interactions.ts | Browser-only, fixed host/3 routes, không refresh/retry; synthetic OAuth dùng fake gateway; live G1 chưa đạt |
| 40 route requestBinding/inputSchema trong config/sha-read-candidates.json | src/sha/catalog.ts, src/sha/requests.ts | Strict AJV, switch allowlist, scope server-derived; tests/contracts.test.ts đại diện, không 40 route accepted |
| identity/tree theo session_identity và Gateway docs | src/policy.ts | Authoritative username/broker tree, HMAC subject/session/generation refs; synthetic cross-user/response drift assertions |
| fieldMap/unit trong catalog, report/revenue_sync contract | src/dto.ts, src/service.ts | Decimal/null/missing, whitelist, paging budget/repeated totals; đơn vị vẫn unverified, release disabled |
| Kiến trúc Profile MCP (không SHA feature) | src/oauth.ts, src/store.ts, src/crypto.ts, migration 002 | Official library adapter, encrypted artifacts, atomic consume/quota/revoke, EXECUTE-only; tests/security.test.ts, tests/oauth.test.ts |
| MCP authorization/SDK chính thức | src/mcp.ts, src/app.ts, api/index.ts | Stateless Streamable HTTP, 401/discovery, 2 metadata tools, SDK integration test |

Callback được đối chiếu [OpenAI auth](https://developers.openai.com/plugins/build/auth), [Claude authentication](https://claude.com/docs/connectors/building/authentication). Claude thực tế đang DCR 400; không ghi supported/passed. CA TLS được đối chiếu source Supabase Studio; URL/fingerprint tại [database-ca-provenance.json](../config/database-ca-provenance.json). Native runtime dependencies pin trong package-lock.json.
