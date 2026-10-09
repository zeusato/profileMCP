# Checkpoint Profile MCP — 09/10/2026

Đại ca yêu cầu dừng tại đây, lưu checkpoint và push vào https://github.com/zeusato/profileMCP.git để tối tiếp tục. Luôn xưng em, gọi người dùng là Đại ca. Không cần lịch sử chat để tiếp tục từ tài liệu này.

## Kết quả hiện có

- Source Node 24 ESM/TypeScript; official MCP SDK 1.32.1, OAuth AS oidc-provider 9.12.2, Express 5.2.1, Postgres.js 3.4.9. Registry đã kiểm và lockfile đã pin.
- Production: **https://profile-mcp.vercel.app**. MCP: **https://profile-mcp.vercel.app/api/mcp**. Issuer: **https://profile-mcp.vercel.app**.
- Vercel project profile-mcp, ID prj_gCrysy0jokg400TLZHJvfnVwi8nB, scope manhquyet88-gmailcoms-projects, Hobby. Node 24.x, function region syd1.
- Deployment production mới nhất: dpl_99wAQ6f6L1r9ZYhSfQKYRdSDN3v1; [inspect](https://vercel.com/manhquyet88-gmailcoms-projects/profile-mcp/99wAQ6f6L1r9ZYhSfQKYRdSDN3v1). Đã build/deploy thành công. Canonical URL public: health, ready, protected-resource metadata và AS metadata HTTP 200; MCP không token HTTP 401.
- Supabase project rcdmgdnxndyjnosxikbu (Digital16), Sydney. Baseline 20261009_001 và migration 20261009_002 đã áp dụng. **Không chạy lại hai migration này.** 12 bảng ENABLE+FORCE RLS. Data API off theo biên bản ban đầu.
- Runtime login profile_mcp_app thừa hưởng role profile_mcp_runtime: EXECUTE private RPC, không SELECT/DML bảng. Pooler 6543, max 2 connections/instance, prepared statements off, TLS xác minh CA Supabase. Kiểm trực tiếp trả role đúng/version 002.
- Keys và env production đã nạp Vercel. Allowlist có một thành viên do Đại ca tự nhập ID SHA qua terminal. Không lưu mật khẩu/OTP hoặc in lại ID người dùng.
- OAuth code + PKCE S256, resource/audience, opaque MCP token, rotating refresh, encrypted DB adapter, atomic consume, generation fence/revoke; browser login/matrix/OTP/consent. SHA refresh vẫn false.
- Request builders cho 40 ứng viên, policy/ref/subaccount binding, DTO/decimal/null/coverage đã có nhưng chưa nghiệm thu toàn bộ. config/runtime-release.json vẫn bật **0 operation nghiệp vụ**. Sau auth chỉ có 2 metadata tools.
- 13 tests synthetic đã pass: two-instance OAuth + SDK initialize/list/call, code replay, bad PKCE, rotation/disconnect, crypto, scope, quota/atomic consume, deny-network và contract cơ bản. Xem [VALIDATION](VALIDATION.md), không coi đây là 200 operation test IDs đều passed.
- Kiểm cuối trước push: typecheck/build/native ESM smoke/13 tests/document validator 749 assertions passed. Chạy lại production audit gặp DNS ENOTFOUND registry.npmjs.org; không có audit mới, kết quả 0 findings nói dưới đây thuộc lần trước.

## Điểm dừng: Claude chưa đăng ký OAuth được

Đại ca add URL vào Claude rồi bấm Connect. UI báo **“Couldn't register with SHA MCP's sign-in service”**, reference ofid_f6aee2ce379a830a. Chưa tới form SHA; chưa live login/OTP thành công. GPT chưa nghiệm thu.

Bằng chứng:

1. Vercel logs: discovery 200, /api/mcp 401, **POST /reg 400** hai lần. Public endpoint và DB đều reachable.
2. scripts/probe-registration.mjs đăng ký JSON cơ bản với callback https://claude.ai/api/mcp/auth_callback thành công HTTP 201 cho none, client_secret_post, client_secret_basic. Script không in client ID/secret. Các client smoke chưa dọn khỏi store.
3. AS discovery công bố scopes_supported: ["openid"]; resource metadata công bố 8 read scopes. src/oauth.ts dùng scopes: [] vì prototype trước gặp consent loop khi chỉ grant.addResourceScope.
4. **Giả thuyết chưa xác minh:** Claude gửi scope trong DCR; oidc-provider/lib/helpers/client_schema.js:717 yêu cầu scope thuộc AS scopes và có thể trả 400. Chưa thu metadata request Claude và chưa reproduction có scope. Không ghi là root cause đã chứng minh.

Bước đầu khi tiếp tục: tái hiện DCR với resource scopes; viết regression test rồi sửa AS scope/grant/consent theo API thư viện, giữ resource/audience. Không bỏ redirect/PKCE hoặc chuyển bearer chung để vượt lỗi. Diagnostic chỉ log tên field/error code/enum allowlisted; không raw body, token, cookie, verifier, username/password/OTP. Không DEBUG=oidc-provider:* trên production.

Callback allowlist đúng hai URI: https://chatgpt.com/connector_platform_oauth_redirect và https://claude.ai/api/mcp/auth_callback. Chưa hỗ trợ Claude Code loopback/CIMD. Hai hosted clients dùng OAuth/DCR.

## Kết nối CLI khi làm tiếp — kiểm tra cả hai

Xem [DEPLOYMENT](DEPLOYMENT.md) cho lệnh đầy đủ. PowerShell tại D:\Quyetnm\Dev\Profile MCP. Sau clone chạy npm ci. Node đi kèm node_modules\node\bin\node.exe là 24.21.0; Node hệ thống khi làm là 22.17.1.

**Vercel:** phiên zeusato đã deploy được. Máy khác/hết hạn thì login lại, chọn scope manhquyet88-gmailcoms-projects và link project hiện có profile-mcp; không tạo project mới. .vercel/ và .env.local bị ignore. CLI link có thể sinh .env.local chứa OIDC token, không in/push file.

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

Sau deployment đã thêm truyền AbortSignal chung tới bootstrap identity/tree trong src/service.ts và src/sha/transport.ts; cập nhật env template, docs/tooling/probes. **Chưa redeploy phần cuối này**, theo yêu cầu dừng. Repo checkpoint là local mới hơn artifact production.

## Các việc còn thiếu

1. Sửa DCR Claude; Đại ca tự nhập SHA/password/OTP tại hosted form để chốt G1. Header auth, otpType/matrix/identity/tree hiện theo doc lịch sử, chưa live evidence.
2. Account switch: thư viện dùng auto-submit form; CSP hiện không có script-src explicit nên hash helper không thêm hash. Cần test và sửa bằng CSP hash/nonce chuẩn, không unsafe-inline script.
3. CLI Supabase đúng account để kiểm/cài cleanup. profile_mcp.cleanup_expired() có nhưng **chưa scheduler**; app vẫn kiểm TTL mỗi lần đọc. Query kiểm pg_cron bị 403. Không cấp cleanup EXECUTE cho runtime.
4. G2: thiếu verified shapes/units/role coverage, nested DTO/output schemas và đủ 5 suites/operation. Giữ 40 disabled; generic builder/test không là acceptance.
5. Auth negative/CSRF/wrong client-resource/refresh replay/account switch/multiple user, lease concurrency, mock load 20 users; session expiry retention, full dev dependency audit. Production audit 0 findings ở lần ghi nhận; dev audit từng có 34 findings trong cây tool Vercel, chưa remediate.
6. Kiểm subId nested response, revoke khi bootstrap gặp SHA 401 và tổng timeout auth/read. Chưa hoàn tất G3.
7. GPT/Claude real-client query/expiry/reconnect/disconnect; role thường/quản lý và ảnh hưởng nhiều phiên SHA.
8. Rollback/revoke drill, runbook, config release, TEST-MAP/SOURCE-MAP/VALIDATION/HANDOFF theo bằng chứng mới.

Đọc AGENTS, README, IMPLEMENTATION-PLAN, ARCHITECTURE, AUTH-AND-SESSIONS, TRANSPORT, DATA-QUALITY và kiểm Git trước sửa. Nguồn SHA PC/MCP cũ chỉ đọc; không chạy script/copy credentials, logs hay account data.
