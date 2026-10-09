# Triển khai và kết nối CLI

Checkpoint 09/10/2026: đã deploy production theo yêu cầu Đại ca; live SHA/client acceptance chưa hoàn tất. Đọc [HANDOFF](HANDOFF.md). Không tạo project mới, chạy lại migration hoặc tự sinh bộ keys mới.

## Local

    Set-Location 'D:\Quyetnm\Dev\Profile MCP'
    npm ci
    npm run typecheck
    npm test
    npm run build
    npm run smoke:esm

Repo https://github.com/zeusato/profileMCP.git. Clone đường dẫn khác thì đổi Set-Location. Npm scripts dùng Node 24 đã pin; gọi trực tiếp dùng node_modules\node\bin\node.exe nếu Node hệ thống chưa là 24.

## Vercel

Project profile-mcp, scope manhquyet88-gmailcoms-projects, ID prj_gCrysy0jokg400TLZHJvfnVwi8nB. Account đã deploy zeusato. Canonical issuer https://profile-mcp.vercel.app, resource /api/mcp. Node 24.x, function syd1, Hobby; chưa nâng/mua gói.

    .\node_modules\node\bin\node.exe node_modules/vercel/dist/vc.js whoami

Nếu thiếu/sai phiên, login trong terminal tương tác cho Đại ca tự hoàn tất browser:

    .\node_modules\node\bin\node.exe node_modules/vercel/dist/vc.js login

Link project đã có trên máy mới; .vercel không vào Git:

    .\node_modules\node\bin\node.exe node_modules/vercel/dist/vc.js link --yes --project profile-mcp --scope manhquyet88-gmailcoms-projects

Khi tiếp tục, sau sửa/test, deploy code dùng env production hiện có:

    .\node_modules\node\bin\node.exe node_modules/vercel/dist/vc.js deploy --prod --yes
    .\node_modules\node\bin\node.exe --import tsx scripts/probe.ts --live --origin=https://profile-mcp.vercel.app
    .\node_modules\node\bin\node.exe scripts/read-safe-logs.mjs

Link có thể sinh .env.local chứa OIDC token: không in/push. Không cần env pull hoặc configure-deployment.mjs để redeploy code. Preview chưa có store/keys riêng; không dùng SHA credentials thật trong preview. Canonical production đã kiểm public; chỉ dùng canonical cho clients, không deployment URL có protection. Ready phải 200; MCP không token 401 và resource_metadata challenge.

## Supabase

Digital16 project rcdmgdnxndyjnosxikbu, Sydney. **CLI lần cuối đang ở account không có project này**, query admin 403. Runtime dùng credential riêng vẫn healthy. Chọn account đúng trong browser:

    npx --yes supabase login --agent no --output-format text
    npx --yes supabase projects list

Chỉ tiếp tục khi có project đúng:

    npx --yes supabase link --project-ref rcdmgdnxndyjnosxikbu --yes
    npx --yes supabase db query --linked --file docs/database/CHECK-RUNTIME.sql

Không gửi access token/password/OTP vào chat. Hai flags login tránh lỗi JSON/agent mode không cho prompt. --profile profile-mcp kiểu đường dẫn không extension từng lỗi Unsupported Config Type; không dùng cách đó.

Schema 001/002 đã có: không db reset hoặc chạy lại SCHEMA.sql/002. Baseline từng chạy SQL editor, 002 qua CLI Management API; Supabase migration history chưa được baseline cho db push. Thay đổi mới dùng migration tăng version đã review. Runtime role không có quyền migration/cleanup.

## Environment hiện hành

| Biến | Vai trò |
|---|---|
| APP_ORIGIN, OAUTH_ISSUER, MCP_RESOURCE_URL | Canonical origin/issuer/resource |
| APP_ENV | production; local/preview có policy riêng |
| DATABASE_URL | Pooler 6543, profile_mcp_app; không postgres/service_role |
| DATABASE_CA_CERT | CA chính thức Supabase, TLS rejectUnauthorized true |
| AUTH_ALLOWED_TEAM_ID | Team UUID hiện có |
| SESSION_ENCRYPTION_KEYRING | AES-256-GCM versioned keyring |
| TOKEN_HMAC_KEY | Digest artifact/subject/ref |
| COOKIE_SECRET | Cookie signing keys |
| OAUTH_SIGNING_KEYS | Private signing JWK |
| OAUTH_CLIENTS | [] hiện tại; DCR callback allowlist |
| SHA_LIVE_AUTH_ENABLED | true production để thử browser login |
| SHA_REFRESH_ENABLED | false |
| SHA_UPSTREAM_BASE_URL | https://api.shs.com.vn fixed |

.runtime/env.production.json và .runtime/*.sql là local nhạy cảm; Git/Vercel ignore. Sensitive env Vercel có thể không export plaintext. Máy khác dùng secret manager/kênh riêng do Đại ca quản lý nếu cần local keys; không regenerate khi clone thiếu file. configure-deployment.mjs ghi đè production env, chỉ chạy với bộ keys hiện hành đã xác minh.

Runtime kiểm TLS có CA, role đúng, EXECUTE-only, 12 FORCE RLS. Server SSL enforcement chưa bật; client luôn TLS verified. Cleanup function tồn tại nhưng scheduler chưa cấu hình; kiểm pg_cron và tạo job hạn chế riêng khi CLI đúng account.

## Rollback

Rollback code giữ issuer/resource/keys/schema. Không restore DB để rollback code vì có thể hồi sinh token. Tắt operation qua release config, không fallback nguồn. Chưa tuyên bố hỗ trợ GPT/Claude end to end trước acceptance. Cập nhật HANDOFF/VALIDATION/evidence sau deploy.
