# Profile MCP

MCP dùng SHA Gateway tại api.shs.com.vn, chỉ tra cứu trong quyền từng người. Node 24/TypeScript trên Vercel; Supabase Postgres giữ phiên mã hóa; OAuth code + PKCE qua oidc-provider và official MCP SDK. Login/password/OTP chỉ nhập trên website, không qua model hoặc MCP tools.

**Checkpoint 09/10/2026:** runtime đã deploy tại [profile-mcp.vercel.app](https://profile-mcp.vercel.app), MCP URL https://profile-mcp.vercel.app/api/mcp. Supabase migration 002, 12 bảng FORCE RLS, role EXECUTE-only, TLS verified. 13 tests synthetic đã pass. **Claude đang lỗi DCR HTTP 400, chưa tới login SHA. Chưa nghiệm thu live SHA/GPT/Claude; 40 operation nghiệp vụ disabled.** Hai metadata tools hoạt động sau auth trong synthetic test.

Đại ca yêu cầu lưu checkpoint để tối tiếp tục. **Bắt đầu từ [docs/HANDOFF.md](docs/HANDOFF.md)**: lỗi đang xử lý, cloud IDs, local/production differences, CLI login/link, secrets trên máy khác và việc còn thiếu. Không chạy lại migration 001/002 hoặc tạo keys mới khi clone.

## Kiểm tra local

    npm ci
    npm run typecheck
    npm test
    npm run build
    npm run smoke:esm
    npm run check:docs

Tests dùng synthetic SHA/PGlite, mặc định không gọi cloud/SHA. probe:sha hiện chỉ kiểm public health/readiness/discovery, không phải business live probe. [.env.example](.env.example) chỉ là template trống; secrets không nằm trong repo.

## Tài liệu

1. [Checkpoint](docs/HANDOFF.md), [triển khai và CLI](docs/DEPLOYMENT.md), [kết quả thực](docs/VALIDATION.md).
2. [Implementation gates](docs/IMPLEMENTATION-PLAN.md), [kiến trúc](docs/ARCHITECTURE.md), [auth/session](docs/AUTH-AND-SESSIONS.md), [store](docs/SUPABASE.md).
3. [MCP contract](docs/MCP-CONTRACT.md), [transport](docs/api/TRANSPORT.md), [40 candidate contracts](docs/api/ENDPOINTS.md), [data quality](docs/api/DATA-QUALITY.md).
4. [Test plan](docs/TEST-PLAN.md), [operation test map](docs/api/TEST-MAP.md), [source map](docs/SOURCE-MAP.md), [vận hành](docs/OPERATIONS.md).

40 read candidates nhóm 17 business tools + 2 metadata tools là phạm vi thiết kế, không phải 40 API đã passed. Release thực ở [runtime-release.json](config/runtime-release.json). Không proxy tùy ý, không lệnh/chuyển tiền/sửa hồ sơ; không bearer chung, token passthrough, SHSmart/Fialda/socket/fallback. Refresh SHA thiếu contract nên disabled.
