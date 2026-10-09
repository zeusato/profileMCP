# Cấu hình Supabase đã thực hiện

Ngày thực hiện: **09/10/2026**. Đại ca đã tạo project và yêu cầu tạo schema cùng cấu hình cần thiết cho Profile MCP. Không tạo project mới hoặc nâng gói.

| Thông tin | Giá trị |
|---|---|
| Project | profile mcp |
| Organization | Digital16 |
| Project ref | rcdmgdnxndyjnosxikbu |
| Dashboard | [Supabase project](https://supabase.com/dashboard/project/rcdmgdnxndyjnosxikbu) |
| Region lúc kiểm | Oceania/Sydney, ap-southeast-2 |
| Plan/compute lúc kiểm | Free / Nano |
| Branch | main / production |
| Schema | profile_mcp |
| Migration | 20261009_001 |

## Đã thực hiện và kiểm tra

1. Read-only preflight: database `postgres`, query role `postgres`; chưa có schema profile_mcp và public có 0 bảng. Xác định đúng project trước khi ghi.
2. Áp dụng [SCHEMA.sql](database/SCHEMA.sql) trong một transaction qua SQL editor; UI trả `Success. No rows returned`.
3. Chạy [VERIFY.sql](database/VERIFY.sql) và đọc lại catalog: migration 20261009_001, **11 bảng / 11 ENABLE RLS / 11 FORCE RLS**, 0 policy permissive.
4. `anon`, `authenticated`, `service_role`: schema USAGE=false và số bảng có quyền SELECT=0. Không cấp runtime login role hoặc backend table grants.
5. Tắt **Enable Data API**, Save. Trang tải lại hiển thị “No schemas can be queried”; REST/PostgREST không dùng cho dự án backend này.
6. Không seed user, tài khoản SHA, token, session hoặc dữ liệu giao dịch; không đọc/copy API keys từ dashboard.

## Chưa làm vì phụ thuộc implementation

- Tạo runtime DB role/RPC theo ADR, database connection secret và pooler config cho Vercel.
- Encryption keyring, HMAC/signing/cookie secrets, OAuth storage adapter và atomic functions.
- Allowlist thành viên sau khi xác minh identity SHA; không tạo user giả cho production.
- Preview database riêng, Vercel project/domain/callback; code chưa tồn tại để nối.
- Scheduler cleanup: expiry checks phải có trong runtime trước, chưa tạo cron gọi endpoint chưa có.
- Không bật Supabase Auth providers/OAuth server hoặc Realtime cho bảng session. Dự án dùng SHA login và OAuth AS của Profile MCP theo plan.

Data API off là lựa chọn có chủ đích: runtime sẽ truy cập Postgres trực tiếp/pooler bằng role riêng. Không bật lại Data API hoặc cấp service_role đọc bảng để khắc phục nhanh lỗi kết nối app.

## Baseline migration về sau

SQL được chạy trực tiếp, phiên bản ghi tại `profile_mcp.schema_versions`; **chưa đăng ký Supabase CLI migration history**. Khi triển khai repo migration runner, đối chiếu schema/hash trước rồi baseline migration này bằng quy trình của công cụ; không chạy lại CREATE SCHEMA hoặc drop/recreate để “đồng bộ”. File SCHEMA.sql là bản đã áp dụng, thay đổi tiếp theo tạo version mới.

Hash và kết quả kiểm tra metadata được lưu tại [cloud-setup.json](../config/cloud-setup.json). Cấu hình này là nền database; không chứng minh application authorization, OAuth, login SHA hoặc API DTO đã hoạt động.
