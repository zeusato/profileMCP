# Validation thực tế

Ngày: 09/10/2026. Đây là sổ kết quả thực; test IDs trong TEST-PLAN/TEST-MAP vẫn là planned nếu không ghi rõ ở đây.

## Đã thực hiện

- Kiểm Git SHA PC: working tree sạch, commit 8363a1a1bec8b0d11251ff6f6830d6ea4f747306. Chỉ đọc source/docs, không chạy script repo nguồn.
- Trích metadata không nhạy cảm và biên soạn 40 read candidates, 3 auth control-plane routes, 4 trading writes bị cấm; inventory Swagger 69 path/70 method-path.
- DB-BASE-01: áp dụng SCHEMA.sql thành công trên project rcdmgdnxndyjnosxikbu; readback version 20261009_001 và 11 bảng.
- DB-BASE-02: readback 11/11 ENABLE+FORCE RLS, 0 policy; anon/authenticated/service_role không có schema USAGE và SELECT trên bảng.
- DB-BASE-03 phần cấu hình: Data API tắt và vẫn hiển thị disabled sau tải lại dashboard. Không thêm schema vào API exposure. Chưa có runtime API request để test vì không tạo/copy key.
- Document validator: kết quả máy lưu ở [document-validation.json](../config/document-validation.json), command `node scripts/check-docs.mjs`. Kết quả chỉ có giá trị sau khi file report được sinh trong lần chạy thực.

## Runtime và cloud đã chạy trong checkpoint 09/10/2026

- npm run typecheck; npm test; npm run build; npm run smoke:esm: kết quả actual checkpoint trong HANDOFF. 13 tests synthetic passed; không gọi SHA/live cloud trong test suite.
- Lần kiểm cuối trước push: typecheck, 13/13 tests, build, native ESM smoke và document validator 749 assertions đều passed. Lần chạy lại npm audit --omit=dev bị DNS ENOTFOUND registry.npmjs.org, **không có kết quả audit mới**; lần trước trong phiên production audit trả 0 findings. Không coi lỗi mạng là audit passed.
- tests/contracts.test.ts: 6 cases request binding A/B, phân biệt GET/POST loan, orders today/history/username-vs-broker, strict input/dates, decimal/null/PII, repeated totals/paging và UDF candles. Chỉ assertions đại diện, chưa đủ 200 operation IDs.
- tests/security.test.ts: 6 cases atomic consume 20 callers qua 2 Store objects/PGlite, consumed code không sống lại sau upsert, expiry/revoke fence, crypto AAD/random nonce/rotation/tamper, 40 disabled + writes chặn zero network, cross-user refs/subaccount/nested account drift, envelope/content type/body size, EXECUTE-only và quota concurrent budget. Không ghi mọi SEC/DB ID đã đạt toàn bộ.
- tests/oauth.test.ts: 1 case HTTP round-robin qua 2 Express/OIDC instances dùng store chung; fake SHA browser login/OTP/consent, PKCE sai, code double-use 1 success, refresh rotation, SDK initialize/list/call, deny DCR callback lạ, encrypted artifact không chứa password/OTP canary, disconnect chặn access/refresh. Chưa kiểm đủ CSRF/refresh replay/role matrix/20-user load dù tên test nhóm nhiều ID.
- Apply migration 20261009_002 thành công qua CLI lúc account đúng; 12/12 ENABLE+FORCE RLS, runtime table read false, runtime RPC true. Tạo dedicated login role; runtime kiểm lại TLS verified trả profile_mcp_app và schema version 002. Một active membership; không lưu ID/account vào evidence.
- Vercel deployment dpl_99wAQ6f6L1r9ZYhSfQKYRdSDN3v1 READY, canonical https://profile-mcp.vercel.app. Public health/ready/protected resource/AS metadata đều 200; unauthenticated MCP 401 quan sát từ client logs. Node 24 artifact đã chạy với env production.
- DCR public smoke callback Claude HTTP 201 với none/client_secret_post/client_secret_basic; chỉ metadata basic không có scope. Không in secret/id.
- Claude thử thật: discovery 200, MCP 401, POST /reg 400. **CLIENT-CLAUDE-01 chưa passed**, không tới form SHA. GPT chưa test.
- Supabase CLI lần cuối projects list không có project Digital16, admin query 403. Runtime vẫn healthy; cần login CLI đúng account trước admin/cleanup. Không sửa lại schema để xử lý lỗi CLI.

## 10/10/2026 — DCR Claude

- Clone D:\Dev\profileMCP, npm ci từ lockfile. Baseline trước sửa: typecheck và 13/13 tests passed.
- OAUTH-07 / CLIENT-DCR-01 (tests/oauth.test.ts): MCP SDK 1.32.1 auth() tự discovery, DCR với callback Claude và scope từ PRM scopes_supported. Trước sửa: fail InvalidClientMetadataError "scope must only contain Authorization Server supported scope values". Sau sửa: DCR 201, authorization scope đủ 8 read scopes, một lần consent, code exchange, token scope 8 scopes, SDK listTools 2. Cùng test: DCR scope lạ 400 và log diagnostic chỉ có code/reason/field names; client DCR xin thêm openid bị invalid_scope; pre-registered client xin openid nhận invalid_scope trước login SHA (verify count 0).
- Mutation check thủ công: bỏ grant.addOIDCScope thì OAUTH-07 fail tại trang login SHA (consent loop); đã khôi phục.
- Live production (artifact cũ dpl_99wAQ6f6L1r9ZYhSfQKYRdSDN3v1): một DCR kiểu SDK/Claude có resource scopes trả HTTP 400 invalid_client_metadata cùng thông điệp, AS scopes_supported ["openid"], không cấp client. Không gọi SHA.
- Sau sửa: typecheck, 14/14 tests, build, native ESM smoke, document validator passed. npm audit --omit=dev 0 vulnerabilities; npm audit đầy đủ 34 findings dev tree.
- Đại ca tự deploy production dpl_oazx1484NUdnHyg4PTC4seDnG3WT (Ready, alias canonical). Sau deploy: health/ready/PRM/AS metadata 200; MCP không token 401 + resource_metadata; AS scopes_supported 8 read scopes + openid; probe-registration 4/4 HTTP 201, gồm DCR none + 8 resource scopes. Không gọi SHA.
- **CLIENT-CLAUDE-01 vẫn chưa passed** cho tới khi Claude Connect thật đi qua DCR, login SHA/OTP, consent và tools/list.
- Claude Connect trên dpl_oazx1484NUdnHyg4PTC4seDnG3WT: qua DCR, mở form SHA; submit login trả {"error":"INVALID_ORIGIN"} (Đại ca chụp màn hình). Không gọi SHA.
- Tái hiện bằng Chromium của app trên server synthetic local (PGlite, fake SHA, ID/password/OTP giả): POST login 403 INVALID_ORIGIN do Referrer-Policy no-referrer → Origin null. Sau đổi same-origin: login/OTP qua, consent bị CSP form-action 'self' chặn redirect (console). Sau thêm origin redirect_uri vào form-action riêng trang consent: đi tới callback client. Typecheck và 14/14 tests pass với assertions mới trong approve(). Đại ca deploy dpl_BE7kQpGHx1HJqGswsJnQuuLsJ9WS: health/ready/PRM/AS 200, MCP không token 401, AS 9 scopes, Referrer-Policy same-origin trên production.

## 10/10/2026 — G1 trace local (AUTH-01 một phần)

- Claude Connect trên dpl_BE7kQpGHx1HJqGswsJnQuuLsJ9WS: POST login 401 UPSTREAM_AUTH_FAILED (read-safe-logs). Không có log bước SHA trên artifact đó.
- scripts/trace-sha-login.ts --live trên máy local; Đại ca tự nhập ID/password/OTP của chính mình; output chỉ status/kiểu/tên field/số lượng, không giá trị. Kết quả từng lần: (1) login-v2 200, schema fail trustDevice null; (2) generate-matrix HTTP 400 code 405 "Session hết hạn"; (3) sau thêm Session-Key + Bearer null: login-v2/generate-matrix/verify-sotp/get-user-login 200, parseIdentity fail do khác kiểu chữ preferredUsername; (4) sau sửa: login-v2 → generate-matrix → verify-sotp → get-user-login → account-no-and-rem đều 200, session_ready TTL ~479 phút, 1 identity row, 8 accounts, 6 brokers. refresh_token null.
- DevTools web gốc (Đại ca chụp): Authorization: Bearer null cho auth công khai; Session-Key header ở generate-matrix và verify-sotp; Correlation-Id khác nhau mỗi request; login-v2 không Set-Cookie.
- Một tài khoản, một vai trò, từ IP local. **Chưa xác minh từ Vercel**; AUTH-02..09, role khác, logout/đa phiên chưa thử. typecheck, 15/15 tests (thêm SEC-06 diagnostics, trustDevice null + Session-Key, identity case), document validator passed. Chưa deploy.

## 10/10/2026 — production connect và accounts.tree

- dpl_4rRDrodsumhqpGc1azvCuBYBTqsR: Đại ca Connect trên Claude thành công (login/OTP qua Vercel). Em gọi qua connector: list_profile_capabilities trả 40 candidates, liveOperations []; get_profile_data_dictionary trả đủ 40/40 entry, không lỗi. read-safe-logs: /api/mcp có token 200/202; vài POST 400 chưa phân tích.
- Từ điển còn sai lệch cần sửa theo từng operation: evidenceStatus cũ ở mọi entry; identity.current thiếu homeOrder/custodyCd; tiền tố DTO lẫn items[]/data[]/content[]/list[]; nhiều unit unverified.
- accounts.tree + profile.pii (chưa deploy): tests/accounts-tree.test.ts REQ/RAW/DTO/SCOPE/PAGE passed; oauth.test.ts gọi list_managed_accounts qua SDK có/không PII; SEC-02 kiểm tool schema không có oneOf cấp cao nhất. 20/20 tests, typecheck, document validator passed. Mutation bỏ chặn PII làm DTO-accounts.tree fail.

## 10/10/2026 — accounts.tree live qua Claude connector

- Đại ca commit 5ab3f22 (v2), deploy, kết nối lại connector và tick profile.pii. list_profile_capabilities: liveOperations ["accounts.tree"].
- Em gọi list_managed_accounts {operation: accounts.tree} qua connector lúc 13:27:51Z: status ok, 8/8 tài khoản, 6 broker (1 gốc của người dùng + 5 con), coverage complete, nonpaged-full-tree, missing [], có accountNumber/customerName/brokerName vì có profile.pii. Không ghi giá trị vào repo.
- Phiên Claude Code chỉ thấy 1 tool của SHA MCP (tool_count 1) sau khi bật lại connector; 2 tool metadata không còn trong danh sách phía client dù code release trả 3 tool. Chưa rõ nguyên nhân phía client/cấu hình connector; cần kiểm.

## 10/10/2026 — probe live hàng loạt và release lần 2

- Probe chỉ-đọc từ máy local sau một lần login/OTP của Đại ca: 36/38 candidate HTTP 200 code 200; assets.loanDetail (GET loan-info) 405; orders.unconfirmed 400 "Invalid parameter". Cấu trúc lưu config/live-shapes-20261010.json; grep số tài khoản/tên/UUID trong file = 0.
- Release lần 2 (chưa deploy): 34 operation; typecheck; 53/53 tests (gồm 33 bộ REQ/RAW/DTO/SCOPE/PAGE sinh từ fieldMap); document validator 753 assertions.
- Chưa: gọi live từng operation qua connector sau deploy; đối chiếu đơn vị với màn hình SHA; profile.authorized/orderSummary.top/transactions chưa có mẫu không rỗng.

## 10/10/2026 — gọi live release lần 2 qua connector

- 27/34 operation gọi được qua Claude Code connector sau deploy; chi tiết và 7 lỗi sửa trong HANDOFF. Không ghi giá trị khách hàng vào repo.
- Sau sửa: typecheck, 55/55 tests (thêm REQ-common data gap 22–24/05/2026 và regressions subNo/credit body/requestedPeriod/list coverage/PERIOD_FILTER_UNVERIFIED), document validator 753 assertions, build, ESM smoke. Chưa deploy bản sửa.

## 10/10/2026 — phủ toàn bộ API đọc

- Connector sau deploy: 33/34 operation gọi được; subNo, credit body, số 0 đầu đúng; portfolio.account lệch doc (6 key doc không có) → map theo field live.
- Probe --extra (structure-only, appended vào live-shapes): list-confirm 400 fieldName pageSize (5) / 200 với 30; balance 200; sum-transaction 200 toàn null; summary []; authorized null ×8; KMS departments 6, documents 3 và 5 bài.
- Release: 39/42 route bật; typecheck, 60/60 tests (table REQ/RAW/DTO/SCOPE/PAGE cho 38 operation projection + regressions KMS/list-confirm/sum-transaction/path traversal), document validator, build, ESM smoke. Chưa deploy.

## 10/10/2026 — nghiệm thu live release 3 qua connector

- 39/39 operation bật đã gọi live ít nhất một lần qua Claude Code connector trong ngày (các vòng 14:00–14:35Z), trừ market.candles/ticks gọi từ vòng trước cùng ngày. Không ghi giá trị khách hàng vào repo.
- Sửa cuối: KMS HTML→text, mô tả list-confirm; 60/60 tests, document validator, build, ESM smoke. Đã deploy; knowledge.documents live trả văn bản thuần (contentFormat text-from-html).

## Chưa thực hiện / chưa đạt

Live SHA login/OTP/read probes và đơn vị dữ liệu, G1/G2/G4 đầy đủ, refresh SHA (disabled), account switch browser CSP, complete cross-role/cross-user application matrix, 20-user load, cleanup scheduler, rollback/revoke drill và toàn bộ dev-audit remediation. 0 business operations enabled. Local có thay đổi nhỏ sau production chưa redeploy; xem [HANDOFF](HANDOFF.md).

## Giới hạn của kiểm tra tài liệu

Validator kiểm file links nội bộ, JSON parse, uniqueness, count, disabled state, method/host allowlist, traceability/test IDs, input schema structure, schema SQL RLS coverage và dependency-free source metadata. Không xác nhận API còn hoạt động, mapping đơn vị đúng live, dependency compatibility, SQL function semantics chưa viết hoặc quyền runtime chưa cấp.

Kiểm source hashes chỉ xác nhận provenance/nguồn không đổi trong lúc làm; không chứng minh nguồn chính xác về nghiệp vụ. SQL readback xác nhận cấu hình nền đã áp dụng, không thay thế DB-01..06 của application.
