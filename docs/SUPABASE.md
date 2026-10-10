# Supabase: lưu trữ và cấu hình

Checkpoint 09/10/2026 (không đổi đến 10/10/2026 — các release operation không cần migration): đã chọn phương án RPC EXECUTE-only, apply [migration 002](database/20261009_002_runtime.sql), tạo login profile_mcp_app và private role profile_mcp_runtime. Hiện 12 bảng FORCE RLS (thêm request_leases). ShaFlow/Management/Cursor/OAuth dùng encrypted oauth_artifacts; auth_transactions/entitlement_snapshots chưa được runtime sử dụng. Cleanup function đã có nhưng chưa scheduler. Xem [HANDOFF](HANDOFF.md) và [DEPLOYMENT](DEPLOYMENT.md).

## Vai trò

Supabase Postgres là store dùng chung cho Vercel instances. Chưa dùng Supabase Auth làm định danh thay SHA: Supabase Auth không tự trở thành cầu nối ID/password/OTP SHA. Website/OAuth AS của Profile MCP xác thực SHA rồi quản lý session riêng.

Database dùng schema private `profile_mcp`, không thêm vào exposed schemas của Data API. Frontend không có quyền đọc bảng phiên. Nếu project chỉ dành riêng backend này, có thể tắt Data API sau khi kiểm không có ứng dụng khác phụ thuộc; nếu project dùng chung thì giữ cài đặt chung và cách ly schema/grants. [Supabase secure data](https://supabase.com/docs/guides/database/secure-data).

## Schema

[SCHEMA.sql](database/SCHEMA.sql) là nội dung migration cơ sở có thể review; [VALIDATION](VALIDATION.md) ghi riêng đã áp dụng cloud hay chưa. File không tạo người dùng thật, không seed credentials và không cấp quyền runtime login tự động.

| Bảng | Mục đích |
|---|---|
| schema_versions | Ghi phiên bản migration của riêng module |
| teams | Team nội bộ |
| users | Danh tính SHA đã verify; lưu HMAC subject để lookup, metadata nhạy cảm mã hóa |
| memberships | User/team allowlist và vai trò active/disabled |
| upstream_sessions | Token SHA mã hóa, expiry, generation và trạng thái |
| connections | OAuth client/grant gắn user/team và đúng upstream session |
| auth_transactions | Challenge browser login, state/nonce digest, trạng thái và TTL |
| oauth_artifacts | Storage adapter cho OAuth library, payload mã hóa, TTL và consume |
| entitlement_snapshots | Snapshot quyền mã hóa, version và expiry |
| audit_events | Audit tối thiểu không raw payload/account |
| rate_buckets | Quota distributed có TTL |

Users không phải bảng mật khẩu. Memberships là allowlist Profile MCP, không thay quyền SHA. Khởi tạo membership admin phải qua tác vụ quản trị backend riêng sau xác minh danh tính; không mở đăng ký public. Cần xác định SHA subject ổn định ở G1 (issuer+sub được verify nếu có, hoặc identity key của API); không tự gộp user theo tên hiển thị.

## Encryption

Application encrypt AES-256-GCM hoặc AEAD tương đương đã review, nonce ngẫu nhiên mới mỗi lần, authentication tag và keyId. Secret blob là bytes có version, nonce/tag/ciphertext; AAD bind schema/table/row ID/user/team/generation để chống chuyển ciphertext sang row khác.

Khóa encryption trong Vercel secret environment/KMS, không trong database, source hoặc chat. Một keyring versioned hỗ trợ decrypt key cũ và encrypt key mới. Không làm refresh token/SHA token thành text field. Bảng auth_transactions cũng mã hóa sessionKey/transactionId.

Token MCP dạng opaque và browser state/nonce dùng digest/HMAC riêng, không plaintext. HMAC key không dùng lại encryption key. Database backup chứa ciphertext vẫn phải bảo vệ quyền truy cập.

Không lưu password/OTP, không lưu business result rows mặc định. Entitlements là dữ liệu nhạy cảm, mã hóa và TTL ngắn. [Supabase Vault](https://supabase.com/docs/guides/database/vault) là phương án khác; baseline chọn khóa ngoài DB để database dump không kèm khóa giải mã.

## Quyền database

Migration cơ sở bật RLS trên toàn bộ bảng, revoke PUBLIC/anon/authenticated/service_role đối với schema/bảng và không tạo permissive policy. Đây là trạng thái khóa trước khi runtime tồn tại. Supabase SQL editor dùng quyền quản trị để chạy migration; production app không dùng owner/postgres.

Ở G1 tạo role backend riêng với secret qua kênh an toàn và RPC/repository policy đã review. Hai hướng phải chốt bằng ADR trước cấp grants:

1. Role runtime chỉ EXECUTE các function private đã schema-qualify, kiểm owner/user/team trong function; không cấp table DML trực tiếp. Function security definer có `search_path` cố định, tham số typed, không dynamic SQL từ model, revoke execute public.
2. Role backend DML có RLS dựa transaction-local subject/team đã authenticate; bootstrap/auth-system operations có role hẹp riêng. Dùng transaction-local context, không SET session lâu dài qua transaction pooler.

Không dùng Supabase `service_role` rồi mặc định tin RLS sẽ tự cô lập user: service roles có thể bypass RLS. Dù phương án nào, repository methods phải nhận subject/team và dùng composite FK/check; test user A/B bắt buộc. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Kết nối Vercel

Dùng Postgres serverless driver hoặc Supavisor transaction pooler theo driver/runtime đã kiểm. Giới hạn pool nhỏ mỗi instance; tổng connection budget tính theo concurrency. TLS bắt buộc. Không giả định mọi driver prepared statement chạy với mọi pooler. Migration dùng direct/session connection thích hợp, không trộn với runtime pool. [Serverless connections](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers), [Postgres connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

Secrets cần sau khi có runtime: database URL role riêng, encryption keyring, HMAC key, OAuth signing material/cookie secret theo library. Không dùng `NEXT_PUBLIC_` cho bất kỳ secret nào. Không bật Supabase OAuth server/anonymous sign-in/email-password provider chỉ để “cho đủ cấu hình” khi kiến trúc chưa cần.

## Atomic operations phải triển khai

- `claimAuthTransaction(id, version, browserBinding)`: một worker chuyển challenge_ready → verifying; TTL check theo DB time.
- `completeLogin(...)`: tạo session và bind connection cùng user/team trong transaction; mark challenge succeeded và xóa ciphertext challenge.
- `consumeOAuthArtifact(id, now)`: atomic consume một lần; adapter không được chỉ SELECT rồi UPDATE rời nhau.
- `replaceSessionTokens(id, expectedGeneration, ciphertext)`: CAS và tăng generation, cập nhật connections/entitlement invalidation theo transaction.
- `revokeConnection(id, owner)`: revoke grant/session và tăng generation nguyên tử.
- `consumeRateLimit(bucketKey)`: atomic increment/window, không SELECT-count bằng RAM.

Không giữ transaction mở qua network SHA. Lease cho network step có fencing/version và expiry; mất response không mặc định thất bại an toàn để replay.

## TTL, cleanup và backup

Đề xuất: challenge secrets xóa ngay kết thúc/hết hạn; artifact hết hạn xóa sau grace 24 giờ; session revoked xóa ciphertext ngay và giữ metadata audit tối đa 30 ngày; entitlement hết hạn xóa trong ngày; audit 30 ngày; quota bucket 24 giờ. Đây là policy dự kiến, không yêu cầu lưu lâu dữ liệu SHA.

Ứng dụng luôn kiểm expiry khi dùng, không trông chờ cron. Cleanup job chỉ được tạo khi scheduler và authentication đã triển khai; thời điểm cấu hình DB ban đầu chưa cần bật cron không có handler. Backup/retention thực tế theo gói của Đại ca; không nâng gói tự động. Restore phải revoke các session/artifact phục hồi để tránh hồi sinh token đã dùng.
