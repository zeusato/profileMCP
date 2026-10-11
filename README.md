# Profile MCP

MCP dùng SHA Gateway tại api.shs.com.vn, chỉ tra cứu trong quyền từng người. Node 24/TypeScript trên Vercel; Supabase Postgres giữ phiên mã hóa; OAuth code + PKCE qua oidc-provider và official MCP SDK. Login/password/OTP chỉ nhập trên website, không qua model hoặc MCP tools.

**Trạng thái 10/10/2026:** production tại [profile-mcp.vercel.app](https://profile-mcp.vercel.app), MCP URL https://profile-mcp.vercel.app/api/mcp. Đăng nhập SHA thật (ID/mật khẩu/matrix OTP) chạy từ Vercel; **39/42 operation đọc đã bật và đã gọi live qua Claude** (18 tool nghiệp vụ + 2 metadata): khách hàng, hồ sơ, tài sản, danh mục, sức mua, khoản vay, lệnh, báo cáo môi giới, khuyến nghị, nhóm, thị trường, kho tri thức KMS. PII khách hàng sau scope `profile.pii` (tự chọn khi kết nối); số liệu giữ giá trị nguồn kèm nhãn đơn vị unverified. ChatGPT Work đã gọi 2 tool metadata và accounts.tree có profile.pii (8/8 tên khách và số tài khoản đầy đủ); chưa kiểm các nghiệp vụ/PII còn lại và vòng đời phiên qua GPT. Cấu hình OAuth cần tắt OIDC như [USER-GUIDE](docs/USER-GUIDE.md). 60 tests synthetic pass.

- **Người dùng:** đọc [USER-GUIDE](docs/USER-GUIDE.md) để kết nối Claude/ChatGPT và cách hỏi.
- **Người phát triển/vận hành:** bắt đầu từ [HANDOFF](docs/HANDOFF.md) (trạng thái, cloud IDs, secrets, việc còn lại). Không chạy lại migration 001/002 hoặc tạo keys mới khi clone.

## Kiểm tra local

    npm ci
    npm run typecheck
    npm test
    npm run build
    npm run smoke:esm
    npm run check:docs

Tests dùng synthetic SHA/PGlite, mặc định không gọi cloud/SHA. Bằng chứng live opt-in: `scripts/trace-sha-login.ts --live --probe` (người dùng tự đăng nhập trên trang 127.0.0.1; chỉ in cấu trúc). [.env.example](.env.example) chỉ là template trống; secrets không nằm trong repo.

## Tài liệu

Từ điển trạng thái/mã số và chữ: [sha-code-dictionary.json](config/sha-code-dictionary.json), kèm nguồn và mức xác minh. Tra bằng get_profile_data_dictionary; kết quả nghiệp vụ liên quan cũng có meta.codeDictionary. Nhãn chưa xác minh không được coi là enum chắc chắn; xem [quy tắc dữ liệu](docs/api/DATA-QUALITY.md).

1. [Hướng dẫn sử dụng](docs/USER-GUIDE.md), [checkpoint](docs/HANDOFF.md), [triển khai và CLI](docs/DEPLOYMENT.md), [kết quả thực](docs/VALIDATION.md), [vận hành](docs/OPERATIONS.md).
2. [Implementation gates](docs/IMPLEMENTATION-PLAN.md), [kiến trúc](docs/ARCHITECTURE.md), [auth/session](docs/AUTH-AND-SESSIONS.md), [store](docs/SUPABASE.md).
3. [MCP contract](docs/MCP-CONTRACT.md), [transport](docs/api/TRANSPORT.md), [42 operation contracts](docs/api/ENDPOINTS.md), [data quality](docs/api/DATA-QUALITY.md).
4. [Test plan](docs/TEST-PLAN.md), [operation test map](docs/api/TEST-MAP.md), [source map](docs/SOURCE-MAP.md).

Release thực ở [runtime-release.json](config/runtime-release.json); catalog ở [sha-read-candidates.json](config/sha-read-candidates.json), fieldMap sinh bằng `scripts/gen-fieldmaps.mjs` từ [live-shapes-20261010.json](config/live-shapes-20261010.json). Không proxy tùy ý, không lệnh/chuyển tiền/sửa hồ sơ; không bearer chung, token passthrough, SHSmart/Fialda/socket/fallback. Refresh SHA không có nên hết phiên (~8 giờ) phải đăng nhập lại.
