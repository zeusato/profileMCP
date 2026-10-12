# Vận hành

## Luồng người dùng

Kết nối MCP → website login SHA → OTP → consent đọc → quay về client. Website quản lý connections hiển thị client, thời điểm login, expiry và nút disconnect. Khi hết phiên SHA, trả REAUTH_REQUIRED và cho mở trang reconnect; không yêu cầu nhập OTP vào hội thoại model.

Hướng dẫn người dùng Claude/ChatGPT: [USER-GUIDE](USER-GUIDE.md) (Claude đã kiểm thực tế 10/10/2026; phần ChatGPT là tham khảo, cập nhật sau nghiệm thu). Trang quản lý kết nối: https://profile-mcp.vercel.app/connections.

## Theo dõi

Bản sửa retry local 12/10/2026 (chưa deploy): POST auth thất bại có thể trả **303 rồi GET 200** để đưa người dùng về form mới. Không dùng HTTP 200/303 làm bằng chứng login thành công; xem event `oauth.interaction_failed`. Reason `member_not_allowed` = ID chưa có quyền, `csrf_mismatch` = form/CSRF không khớp, `authorization_mismatch` = client/params không khớp; `flow_expired` = handle đã hết hạn hoặc bị xóa. read-safe-logs cho phép các reason này và step restart; không ghi hoặc in form, username, cookie hay raw logs.

Metrics không PII: request count theo operation/result, latency p50/p95, upstream HTTP/envelope error class, schema mismatch, timeout, 429, DB pool saturation, auth expiry/replay rejected, partial/truncated results. Không ghi account number hoặc raw upstream body vào label.

Không log URL có query tài khoản nguyên vẹn. Correlation ID riêng cho request MCP và từng request SHA; audit không cần nội dung truy vấn để xác định lỗi transport. Cảnh báo khi error/shape tăng có ngưỡng theo baseline đo được, không hardcode những ngưỡng tưởng là SLA SHA.

## Runbook

| Sự cố | Hành động |
|---|---|
| SHA 401/expired | Mark reauth, revoke hoặc ngừng dùng token theo contract; yêu cầu login lại |
| SHA 403 | Kiểm role/scope; không thử broker khác hoặc nâng quyền |
| Shape/unit thay đổi | Disable operation liên quan, lưu chỉ schema fingerprint; review contract, test rồi bật lại |
| Supabase unavailable | STORE_UNAVAILABLE, không dùng cached bearer/quyền để bỏ store check |
| Lộ session/key | Revoke affected grants/session, tăng generation; rotate key có version; không gửi token vào ticket |
| Nhiều login SHA thu hồi nhau | Báo người dùng giới hạn upstream đã kiểm; cân nhắc one active connection bằng ADR |
| Quota/429 | Backoff có giới hạn, giảm concurrency; không chuyển nguồn ngầm |
| Pagination đổi total | PARTIAL/unstable snapshot, không khẳng định sum đủ |
| Người dùng báo lỗi kết nối/đăng nhập | node scripts/read-safe-logs.mjs: status /reg và /interaction/[redacted]/login, verify, consent; event oauth.registration_rejected và sha.upstream (bước SHA, HTTP/envelope code) |
| Shape SHA đổi (UPSTREAM_SHAPE_CHANGED tăng) | Probe lại bằng scripts/trace-sha-login.ts --live --probe [--extra] (người dùng tự login), cập nhật live-shapes, chạy node scripts/gen-fieldmaps.mjs, npm test, deploy; operation chưa sửa kịp thì bỏ khỏi runtime-release.json |
| Thêm thành viên | scripts/add-member.ts trên máy có .runtime (ID lưu chữ thường); không tạo lại keys |

## Secret rotation

Keyring giữ key cũ chỉ để decrypt trong thời gian chuyển; encrypt mới dùng key mới. Re-encrypt theo batch bounded, optimistic generation check; tránh đổi token mới bằng ciphertext của generation cũ. Chỉ xóa key cũ khi kiểm không còn ciphertext phụ thuộc và backup policy đã giải quyết. HMAC/signing key rotation có thể buộc re-login; chuẩn bị thông báo trên UI khi triển khai.

Cleanup định kỳ không thay expiry validation. Xóa ciphertext challenge/session khi không còn cần. Không lưu business data để “tiện debug”. DB audit retention đề xuất 30 ngày, điều chỉnh theo chính sách nội bộ trước production.

## Nguồn điều tra

Phân biệt lỗi request/mapping của MCP với lỗi nguồn bằng trace gồm operation revision, normalized input không PII, scope hash, HTTP/envelope code, schema fingerprint, source period/unit metadata. Không kết luận API lỗi chỉ vì model diễn giải sai; so sánh DTO, raw field có quyền đọc tại thời điểm điều tra, và cách model dùng field.
