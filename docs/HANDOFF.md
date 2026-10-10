# Checkpoint Profile MCP — 10/10/2026

Checkpoint gốc 09/10/2026 đã push vào https://github.com/zeusato/profileMCP.git. Ngày 10/10/2026 tiếp tục trên clone D:\Dev\profileMCP: tái hiện và sửa lỗi DCR của Claude (mục bên dưới); Đại ca tự deploy production từ working tree. **Chờ Đại ca bấm Connect lại trên Claude.** Luôn xưng em, gọi người dùng là Đại ca. Không cần lịch sử chat để tiếp tục từ tài liệu này.

## Kết quả hiện có

- Source Node 24 ESM/TypeScript; official MCP SDK 1.32.1, OAuth AS oidc-provider 9.12.2, Express 5.2.1, Postgres.js 3.4.9. Registry đã kiểm và lockfile đã pin.
- Production: **https://profile-mcp.vercel.app**. MCP: **https://profile-mcp.vercel.app/api/mcp**. Issuer: **https://profile-mcp.vercel.app**.
- Vercel project profile-mcp, ID prj_gCrysy0jokg400TLZHJvfnVwi8nB, scope manhquyet88-gmailcoms-projects, Hobby. Node 24.x, function region syd1.
- Deployment production mới nhất 10/10/2026: dpl_4rRDrodsumhqpGc1azvCuBYBTqsR (sửa G1 auth); trước đó cùng ngày dpl_BE7kQpGHx1HJqGswsJnQuuLsJ9WS (Origin/CSP) và dpl_oazx1484NUdnHyg4PTC4seDnG3WT (DCR). Đại ca tự chạy vc deploy --prod từ D:\Dev\profileMCP; Ready, alias profile-mcp.vercel.app. Canonical URL public: health, ready, protected-resource metadata và AS metadata HTTP 200; MCP không token HTTP 401 kèm resource_metadata. Bản trước để rollback code: dpl_99wAQ6f6L1r9ZYhSfQKYRdSDN3v1.
- Supabase project rcdmgdnxndyjnosxikbu (Digital16), Sydney. Baseline 20261009_001 và migration 20261009_002 đã áp dụng. **Không chạy lại hai migration này.** 12 bảng ENABLE+FORCE RLS. Data API off theo biên bản ban đầu.
- Runtime login profile_mcp_app thừa hưởng role profile_mcp_runtime: EXECUTE private RPC, không SELECT/DML bảng. Pooler 6543, max 2 connections/instance, prepared statements off, TLS xác minh CA Supabase. Kiểm trực tiếp trả role đúng/version 002.
- Keys và env production đã nạp Vercel. Allowlist có một thành viên do Đại ca tự nhập ID SHA qua terminal. Không lưu mật khẩu/OTP hoặc in lại ID người dùng.
- OAuth code + PKCE S256, resource/audience, opaque MCP token, rotating refresh, encrypted DB adapter, atomic consume, generation fence/revoke; browser login/matrix/OTP/consent. SHA refresh vẫn false.
- Request builders cho 40 ứng viên, policy/ref/subaccount binding, DTO/decimal/null/coverage đã có nhưng chưa nghiệm thu toàn bộ. config/runtime-release.json vẫn bật **0 operation nghiệp vụ**. Sau auth chỉ có 2 metadata tools.
- 14 tests synthetic pass ngày 10/10/2026 (13 cũ + OAUTH-07): two-instance OAuth + SDK initialize/list/call, code replay, bad PKCE, rotation/disconnect, DCR kiểu SDK/Claude có resource scopes, crypto, scope, quota/atomic consume, deny-network và contract cơ bản. Xem [VALIDATION](VALIDATION.md), không coi đây là 200 operation test IDs đều passed.
- Kiểm 10/10/2026 trên clone mới: typecheck/build/native ESM smoke/14 tests/document validator passed. npm audit --omit=dev: 0 vulnerabilities. npm audit đầy đủ: 34 findings (1 critical, 29 high, 3 moderate, 1 low) trong dev tree, chưa remediate.

## DCR Claude: đã tái hiện, đã sửa và deploy, chờ Claude Connect

Triệu chứng 09/10: Đại ca add URL vào Claude rồi bấm Connect, UI báo **“Couldn't register with SHA MCP's sign-in service”**, reference ofid_f6aee2ce379a830a. Vercel logs: discovery 200, /api/mcp 401, **POST /reg 400** hai lần. Chưa tới form SHA.

Bằng chứng 10/10/2026:

1. Tài liệu Claude connectors: khi 401 không có scope trong WWW-Authenticate, Claude xin các scope trong scopes_supported của protected-resource metadata. MCP SDK 1.32.1 (client/auth.js registerClient) gửi chính scope đó trong body DCR.
2. Gửi một DCR kiểu đó (callback Claude, none, scope = 8 read scopes từ PRM) tới production hiện hành: **HTTP 400 invalid_client_metadata, "scope must only contain Authorization Server supported scope values"**, AS scopes_supported ["openid"], không cấp client. Cùng endpoint/status với log Claude. Chưa thu body request thật của Claude nên đây là nguyên nhân đã tái hiện, chưa phải biên bản Claude.
3. Regression OAUTH-07 dùng SDK auth() chính thức: trước sửa fail đúng lỗi trên; sau sửa pass. Mutation check: bỏ grant.addOIDCScope thì flow quay lại trang login SHA (consent loop cũ).

Sửa trong src/oauth.ts và src/interactions.ts, giữ resource/audience/PKCE/redirect allowlist:

- Provider scopes = 8 read scopes; AS discovery công bố openid + 8 scopes. DCR scope ngoài danh sách vẫn 400.
- Consent grant cả addOIDCScope và addResourceScope cho đúng các scope đã đồng ý; access token vẫn audience /api/mcp, scope theo resource.
- Authorization xin scope ngoài 8 read scopes (ví dụ openid) hoặc không có scope: trả invalid_scope về redirect_uri trước khi login SHA, thay vì lặp consent. Client DCR có scope bị chặn xin rộng hơn bởi thư viện.
- /reg bị từ chối ghi một dòng console.warn JSON event oauth.registration_rejected: error code, reason trong allowlist, tên field metadata; không giá trị. scripts/read-safe-logs.mjs lọc lại event này. scripts/probe-registration.mjs có thêm case DCR có resource scopes.

Sau deploy dpl_oazx1484NUdnHyg4PTC4seDnG3WT: AS scopes_supported có 8 read scopes + openid; probe-registration 4/4 case HTTP 201, gồm case none + 8 resource scopes trước đây 400. Probe tạo thêm 4 client smoke trong store. Bước tiếp: Đại ca bấm Connect lại trên Claude và tự nhập SHA/password/OTP trên form. Nếu vẫn 400, đọc event oauth.registration_rejected bằng read-safe-logs. Không DEBUG=oidc-provider:* trên production.

### Lần Connect 10/10 sau deploy: INVALID_ORIGIN tại form login — đã sửa, deploy dpl_BE7kQpGHx1HJqGswsJnQuuLsJ9WS

Claude đã qua DCR và mở form SHA trên production, nhưng bấm Tiếp tục thì trình duyệt hiện {"error":"INVALID_ORIGIN"}. POST bị middleware chặn trước handler nên không gọi SHA, không phát sinh OTP.

- Nguyên nhân 1: Referrer-Policy no-referrer làm trình duyệt gửi Origin: null cho form POST; middleware app.ts và checkOrigin chỉ nhận đúng origin. Synthetic test luôn tự gắn Origin nên không bắt được. Sửa: Referrer-Policy same-origin (request khác origin vẫn không có Referer). Origin null vẫn bị 403.
- Nguyên nhân 2, lộ ra khi đi tiếp bằng trình duyệt: CSP form-action 'self' chặn chuỗi redirect sau nút Cho phép kết nối (Chrome kiểm form-action cho cả redirect tới redirect_uri). Sửa: chỉ trang consent đặt form-action 'self' + origin của redirect_uri đã được provider kiểm; các trang khác giữ 'self'.
- Bằng chứng: server synthetic local (PGlite, fake SHA, tài khoản giả) trên Chromium của app. Trước sửa: POST login 403 INVALID_ORIGIN; sau sửa 1: consent bị CSP chặn (console form-action); sau sửa 2: login → OTP → consent → điều hướng tới callback client. tests/helpers.ts approve() kiểm Referrer-Policy, Origin null 403 và CSP consent; 14/14 tests pass.

Đại ca tự deploy dpl_BE7kQpGHx1HJqGswsJnQuuLsJ9WS ([inspect](https://vercel.com/manhquyet88-gmailcoms-projects/profile-mcp/BE7kQpGHx1HJqGswsJnQuuLsJ9WS)), Ready, alias canonical. Kiểm sau deploy: health/ready/PRM/AS 200, MCP không token 401, AS 9 scopes, trang / có Referrer-Policy same-origin và CSP form-action self. CSP trang consent chỉ kiểm được trong luồng thật.

### Connect trên dpl_BE7kQpGHx1HJqGswsJnQuuLsJ9WS: UPSTREAM_AUTH_FAILED — G1 trace local, đã sửa, chưa deploy

Claude qua DCR và form; POST /interaction/…/login trả 401 UPSTREAM_AUTH_FAILED (SHA trả 401/403 ở login-v2 hoặc generate-matrix; allowlist đã khớp vì không phải 403). Production chưa có log chẩn đoán nên chưa biết do sai mật khẩu hay gateway chặn egress Vercel (syd1).

Theo đề nghị của Đại ca, thêm scripts/trace-sha-login.ts: trang 127.0.0.1 có token ngẫu nhiên, Đại ca tự nhập ID/password/OTP, chạy adapter production từ máy local và chỉ in status/kiểu/tên field/số lượng. Qua 6 lần trace kết hợp DevTools web gốc, đã sửa:

1. login-v2 trả trustDevice null → schema nhận null, chuyển nguyên sang bước sau.
2. generate-matrix HTTP 400 code "405" "Session hết hạn" → thiếu header Session-Key (web gốc gửi sessionKey ở header, cả generate-matrix và verify-sotp). Thêm Session-Key và Authorization: Bearer null như client chính thức. Correlation-Id/cookie không liên quan.
3. preferredUsername của get-user-login khác kiểu chữ ID người gõ → identity so khớp không phân biệt hoa/thường, lưu dạng chuẩn SHA; allowlist digest chữ thường, Store.member vẫn đọc bản ghi cũ đúng kiểu chữ; add-member lưu chữ thường.

Trace cuối 10/10/2026: login-v2 → generate-matrix → verify-sotp → get-user-login → account-no-and-rem đều 200; session_ready, TTL ~8 giờ, 1 identity row, 8 accounts, 6 brokers. refresh_token null. Contract chi tiết ở [AUTH-AND-SESSIONS §3](AUTH-AND-SESSIONS.md). Thêm log production đã khử nhạy cảm: event sha.upstream (bước, HTTP status, content-type, envelope code, tên key) và sha.shape_mismatch/sha.login_mismatch; read-safe-logs giữ tên bước login/verify/consent. 15/15 tests.

Đại ca deploy dpl_4rRDrodsumhqpGc1azvCuBYBTqsR (20:12 10/10/2026) và Connect thành công trên Claude: SHA login/OTP từ Vercel syd1 chạy được (không bị chặn IP), /api/mcp có token trả 200, em gọi được list_profile_capabilities và get_profile_data_dictionary đủ 40/40 entry qua connector. liveOperations lúc đó vẫn [].

### accounts.tree — release đầu tiên, chưa deploy

Đại ca hỏi danh sách khách hàng đang quản lý và chọn (AskUserQuestion 10/10/2026): số tài khoản + tên khách hàng nằm sau scope riêng profile.pii. Đã làm:

- SCOPES thêm profile.pii (PRM/AS công bố 9 scopes). Consent hiện ô chọn profile.pii không tick sẵn; bỏ trống thì grant ghi rejected, token không có scope.
- list_managed_accounts/accounts.tree dùng chính response bootstrap account-no-and-rem (không gọi lần hai). Không profile.pii: accountRef, số che ***xxx, brokerRef/brokerCode. Có profile.pii: thêm accountNumber, customerName, brokerName. Tối đa 400 tài khoản rồi truncated. Bootstrap gặp SHA 401 giờ revoke session.
- Tool schema gộp thành một object (operation enum), không oneOf cấp cao nhất.
- runtime-release.json bật accounts.tree; catalog status released, fieldMap theo shape live; check-docs đối chiếu catalog với release.
- tests/accounts-tree.test.ts 5 suite REQ/RAW/DTO/SCOPE/PAGE + E2E SDK có/không PII trong oauth.test.ts; 20/20 tests; mutation bỏ chặn PII làm DTO test fail.

Bước tiếp: Đại ca deploy, rồi **ngắt và kết nối lại connector** trên Claude (token cũ chỉ có 8 scopes), tick ô profile.pii ở trang consent, rồi hỏi danh sách khách hàng.

Nguồn tham khảo cho các operation tiếp theo: Đại ca chỉ D:DevSHA_PCSHA_PC_code (docs/api). Kiểm 10/10/2026: HEAD 7261a8d, working tree có file sửa chưa commit, khác commit 8363a1a trong SOURCE-MAP. Chỉ đọc docs; không đọc logs/output/tmp, không chạy script; ghi commit/hash khi dùng làm bằng chứng.

Callback allowlist đúng hai URI: https://chatgpt.com/connector_platform_oauth_redirect và https://claude.ai/api/mcp/auth_callback. Tài liệu Claude yêu cầu đúng callback claude.ai cho hosted apps; trang hỗ trợ Anthropic nhắc có thể đổi sang https://claude.com/api/mcp/auth_callback sau này, chưa thêm. Chưa hỗ trợ Claude Code loopback/CIMD. Các client smoke DCR cũ chưa dọn khỏi store.

## Kết nối CLI khi làm tiếp — kiểm tra cả hai

Xem [DEPLOYMENT](DEPLOYMENT.md) cho lệnh đầy đủ. Máy gốc D:\Quyetnm\Dev\Profile MCP; clone 10/10 tại D:\Dev\profileMCP (Node hệ thống 22.18.0). Sau clone chạy npm ci. Node đi kèm node_modules\node\bin\node.exe là 24.21.0.

**Vercel:** phiên zeusato đã deploy được trên máy gốc. Clone D:\Dev\profileMCP ngày 10/10: Đại ca đã login zeusato, em đã link đúng prj_gCrysy0jokg400TLZHJvfnVwi8nB. Vercel link tự chèn .vercel/.env* vào cuối .gitignore làm mất ngoại lệ !.env.example; đã hoàn nguyên. Máy khác thì login lại, chọn scope manhquyet88-gmailcoms-projects và link project hiện có profile-mcp; không tạo project mới. .vercel/ và .env.local bị ignore. CLI link có thể sinh .env.local chứa OIDC token, không in/push file.

**Supabase:** phiên CLI đã thay đổi trong lúc làm. Sau lượt Đại ca báo done, link/apply 002/provision thành công; **kiểm cuối checkpoint lại chỉ thấy Senergy/infoHub/sales-dashboard/Genius-kids, không thấy Digital16**. db query --linked trả 403 DbConfigLoginRoleStatusError. Runtime DB và /api/ready vẫn chạy bằng credential riêng.

Muốn migration/cleanup/admin, login tài khoản có quyền Digital16 rcdmgdnxndyjnosxikbu trong terminal tương tác:

    npx --yes supabase login --agent no --output-format text
    npx --yes supabase projects list
    npx --yes supabase link --project-ref rcdmgdnxndyjnosxikbu --yes
    npx --yes supabase db query --linked --file docs/database/CHECK-RUNTIME.sql

Hai flags login tránh lỗi ProfileLoadError/NonInteractiveError đã gặp. Không dùng --profile profile-mcp kiểu đường dẫn không extension. Đại ca tự hoàn tất browser/verification, không gửi token/OTP vào chat. Chỉ thao tác admin sau khi projects list có project đúng. Quyền deploy thật và nghiệm thu cả GPT/Claude đã được giao; checkpoint này tạm dừng công việc.

## Secrets và máy khác

- .runtime/env.production.json, .runtime/provision.sql, .runtime/member.sql là **local nhạy cảm**, bị ignore cả Git/Vercel upload. .env.local, .vercel, supabase/.temp, logs cũng bị ignore.
- Production keys đã có trên Vercel. Sensitive env có thể không export plaintext. Máy khác cần secret manager/kênh riêng do Đại ca quản lý nếu làm tác vụ cần local keys; tuyệt đối không đưa Git/chat. Code-only redeploy dùng env đang có, không tạo keys mới.
- **Không chạy cloud-bootstrap.mjs để khôi phục máy mới:** script sinh keys/team/password mới nếu thiếu local file, không khôi phục bộ hiện hành. Ghi đè có thể phá sessions/allowlist.
- configure-deployment.mjs ghi đè production env từ local file; chỉ chạy với bộ keys hiện hành đã xác minh. Không cần chạy khi chỉ sửa code.

## Local khác production

Sau deployment đã thêm truyền AbortSignal chung tới bootstrap identity/tree trong src/service.ts và src/sha/transport.ts; cập nhật env template, docs/tooling/probes. Ngày 10/10 thêm sửa DCR/scope/consent và diagnostic ở trên. Production dpl_oazx1484NUdnHyg4PTC4seDnG3WT đã gồm các phần này, deploy từ working tree. Sửa Referrer-Policy/CSP form-action (INVALID_ORIGIN) đã deploy ở dpl_BE7kQpGHx1HJqGswsJnQuuLsJ9WS, cũng từ working tree. Sửa G1 auth và log sha.upstream đã deploy ở dpl_4rRDrodsumhqpGc1azvCuBYBTqsR. **accounts.tree/profile.pii chưa deploy.** Commit tương ứng phải chứa đúng nội dung đã deploy.

## Các việc còn thiếu

1. Deploy accounts.tree + profile.pii, reconnect Claude và nghiệm thu danh sách khách hàng; G1 đã chạy trên production; Đại ca tự nhập SHA/password/OTP tại hosted form để chốt G1. Header auth, otpType/matrix/identity/tree hiện theo doc lịch sử, chưa live evidence.
2. Account switch: thư viện dùng auto-submit form; CSP hiện không có script-src explicit nên hash helper không thêm hash. Cần test và sửa bằng CSP hash/nonce chuẩn, không unsafe-inline script.
3. CLI Supabase đúng account để kiểm/cài cleanup. profile_mcp.cleanup_expired() có nhưng **chưa scheduler**; app vẫn kiểm TTL mỗi lần đọc. Query kiểm pg_cron bị 403. Không cấp cleanup EXECUTE cho runtime.
4. G2: thiếu verified shapes/units/role coverage, nested DTO/output schemas và đủ 5 suites/operation. Giữ 40 disabled; generic builder/test không là acceptance.
5. Auth negative/CSRF/wrong client-resource/refresh replay/account switch/multiple user, lease concurrency, mock load 20 users; session expiry retention, full dev dependency audit. Production audit 0 findings ở lần ghi nhận; dev audit từng có 34 findings trong cây tool Vercel, chưa remediate.
6. Kiểm subId nested response, revoke khi bootstrap gặp SHA 401 và tổng timeout auth/read. Chưa hoàn tất G3.
7. GPT/Claude real-client query/expiry/reconnect/disconnect; role thường/quản lý và ảnh hưởng nhiều phiên SHA.
8. Rollback/revoke drill, runbook, config release, TEST-MAP/SOURCE-MAP/VALIDATION/HANDOFF theo bằng chứng mới.

Đọc AGENTS, README, IMPLEMENTATION-PLAN, ARCHITECTURE, AUTH-AND-SESSIONS, TRANSPORT, DATA-QUALITY và kiểm Git trước sửa. Nguồn SHA PC/MCP cũ chỉ đọc; không chạy script/copy credentials, logs hay account data.
