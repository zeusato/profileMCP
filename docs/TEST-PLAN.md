# Kế hoạch kiểm thử và nghiệm thu

Tài liệu này là mục tiêu coverage, không phải danh sách đã passed. Runtime hiện có 63 tests synthetic (tests/*.test.ts, gồm bảng REQ/RAW/DTO/SCOPE/PAGE trong released-operations.test.ts và 3 regression cookie trong interactions.test.ts); coverage thực và những phần còn thiếu ghi tại [VALIDATION](VALIDATION.md), checkpoint tại [HANDOFF](HANDOFF.md). 210 operation test IDs chưa được nghiệm thu toàn bộ.

## Theo từng operation

[TEST-MAP](api/TEST-MAP.md) có 5 test ID cho mỗi trong 42 operation, tổng 210 ID; operation đã bật có test thật tương ứng. Một ID có thể là test suite nhiều assertions.

| Prefix | Assertions bắt buộc |
|---|---|
| REQ-operation | Input strict, date/enum/range; method/path/query/body đúng fixture; broker/emNo/subId lấy từ session; request khác allowlist không được gửi |
| RAW-operation | HTTP200 không đủ; success/error envelope, content type, wrong symbol/account/period, null/missing/array/object và unknown enum |
| DTO-operation | Decimal/locale/unit/negative/null đúng; PII omitted; tổng lặp không cộng đôi; field chưa mapping không lộ; output schema hợp lệ |
| SCOPE-operation | User A/B, broker sibling/ancestor, account ngoài quyền, subId sai, cached scope khác generation, response nested scope drift |
| PAGE-operation | First/last/empty/multiple pages, loop/repeated page, changed total, truncation/budget; nếu route không phân trang kiểm explicit nonpaged coverage |

Fixture synthetic dùng tên/mã giả; không copy payload tài khoản thật. Mỗi fixture có provenance `synthetic` và mô tả shape được nguồn nào hỗ trợ. Fixture khử nhạy cảm từ probe có riêng ngày/role/schema hash và người xác nhận, không chứa token/cookie/account number thật.

## Auth và bảo mật

| ID | Test |
|---|---|
| AUTH-01 | Browser login → matrix → verify; password/OTP không lưu/log, challenge đúng browser/client |
| AUTH-02 | OTP sai/hết hạn/capability không hỗ trợ; không retry tự động |
| AUTH-03 | Double submit/race hai instance chỉ một upstream verify |
| AUTH-04 | Verify timeout không tự replay; state chuyển đúng |
| AUTH-05 | JWT decode không đủ, identity API missing/mismatch => deny |
| AUTH-06 | User SHA hợp lệ nhưng ngoài allowlist bị chặn |
| AUTH-07 | SHA expires/401 → reauth_required; MCP refresh không kéo dài SHA |
| AUTH-08 | Logout/account switch chặn response đang bay bằng generation fence |
| AUTH-09 | Nhiều client/session SHA; kiểm single-session policy upstream |
| AUTH-FLOW-01 | Hai OAuth interaction cùng browser giữ độc lập login/OTP/consent qua hai instance (synthetic) |
| AUTH-FLOW-02 | Thiếu cookie, flow hết hạn/sai UID, CSRF, double submit/replay và log không lộ bí mật (synthetic) |
| AUTH-FLOW-03 | Cookie trước nâng cấp chuyển sang cookie riêng, vẫn kiểm UID (synthetic) |
| OAUTH-01 | Discovery, protected-resource metadata, PKCE S256, resource/audience |
| OAUTH-02 | Code reuse, bad verifier, wrong redirect/client/resource bị từ chối |
| OAUTH-03 | State/CSRF/session fixation, malicious redirect/client metadata |
| OAUTH-04 | Opaque/JWT MCP token sai issuer/audience/scope/revoked không gọi SHA |
| OAUTH-05 | Refresh rotation/reuse detection và atomic adapter consume nhiều instance |
| OAUTH-06 | Consent mới theo client; không token passthrough |
| OAUTH-07 | DCR theo MCP SDK với PRM scopes, một lần consent; scope ngoài read set bị invalid_scope; diagnostic /reg không chứa giá trị |
| MCP-TEXT-01 | Client chỉ đọc TextContent nhận đủ DTO/metadata/lỗi giống structuredContent; PII đúng scope, null/meta giữ nguyên và không lộ bearer |
| SEC-01 | Fuzz URL/path/header/query injection không thoát host/method allowlist |
| SEC-02 | Mọi route mua/bán/sửa/hủy/xác nhận/chuyển tiền/settings bị block ở network dispatcher |
| SEC-03 | Login POST không xuất hiện trong tools/list; không register raw HTTP tool |
| SEC-04 | User A không đọc user B bằng cursor/ref/cache/db query hoặc forged broker code |
| SEC-05 | Crypto nonce mới, AAD row/user/team/generation, key rotation và tamper reject |
| SEC-06 | Logs/errors/traces không có secrets/PII; secret canary test |
| SEC-07 | Research/note chứa prompt injection chỉ được trả làm data; không thay policy |
| SEC-08 | DB unavailable không fallback cache phiên/quyền; default deny |

## Database

| ID | Test |
|---|---|
| DB-BASE-01 | Migration chạy transaction, 11 bảng đúng version |
| DB-BASE-02 | 11/11 ENABLE+FORCE RLS, không grants public/anon/authenticated/service_role |
| DB-BASE-03 | Data API off; không thêm profile_mcp vào exposed schema |
| DB-01 | Composite FK từ connection/entitlement tới đúng user/team/session |
| DB-02 | Role runtime chỉ đủ quyền theo ADR; public roles không đọc/write secrets |
| DB-03 | Atomic challenge/OAuth consume/CAS/revoke/quota dưới cạnh tranh |
| DB-04 | TTL mỗi lần đọc; cleanup idempotent và không xóa session còn active |
| DB-05 | Restore không hồi sinh token/replayable artifacts; rotation key có audit |
| DB-06 | Pooler không rò transaction-local tenant context qua connection reuse |

DB-BASE là cấu hình nền có thể nghiệm thu trước code. DB-01..06 yêu cầu runtime/functions/fixtures thực; schema tạo xong không làm chúng tự passed.

## End to end và vận hành

- RUN-01: Native Node ESM import, build, SDK initialization/list/call trên local và Vercel preview.
- RUN-02: Cold start/two-instance state continuity, concurrent login/revoke, timeout/abort, body size và response budget.
- RUN-03: Synthetic load khoảng 20 users bằng mock SHA, đo store connections/latency/quota; không load test upstream thật mặc định.
- CLIENT-DCR-01: synthetic MCP SDK client (callback Claude) discovery → DCR có scope → authorize → token → tools/list. Không thay CLIENT-CLAUDE-01.
- CLIENT-CLAUDE-01 và CLIENT-GPT-01: OAuth → SHA login/OTP → consent → query → expiry/reconnect → disconnect; ghi phiên bản/client plan ngày thực thử.
- OPS-01: Rollback deploy không đổi issuer/resource hoặc phá schema; operation kill switch không cần đổi API nguồn.
- OPS-02: Secret rotation và incident revoke drill bằng fake credentials.

## Live probe

Live chỉ opt-in, read-only và tài khoản được phép. Credentials nhập website, không chat, không env fixture. Ghi method/path/shape/units/role/time/commit và redacted error classification. Không gọi create/modify/cancel để “chứng minh chặn”: kiểm deny bằng mock transport, assert network request count=0.

Probe cần đủ trường hợp: success nonempty, empty đúng contract, range/permission kiểm soát, page thứ hai nếu có. Tài khoản test không phát sinh mẫu phù hợp thì gate còn mở; không bịa fixture success thực.

## Điều kiện phát hành

Tất cả test bảo mật chung và 5 suite mỗi operation đang bật passed; G0/G1/G3/G4 hoàn tất trong phạm vi client được hỗ trợ; no unknown units trên số đang gắn unit verified; docs/contract/lockfile/preview commit trùng nhau. Operation giữ disabled không cần “passed giả” để đạt đủ số tool.
