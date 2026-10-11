# Kế hoạch triển khai chi tiết

## Mục tiêu nghiệm thu

Người nội bộ kết nối MCP, mở website đăng nhập SHA, hoàn tất OTP và cấp quyền đọc. Client nhận token MCP; câu hỏi về tài sản, khoản vay, giao dịch hoặc báo cáo được trả bằng dữ liệu SHA trong quyền của chính người dùng. Không có đường đi từ tool tới đặt/sửa/hủy/xác nhận lệnh hoặc thao tác thay đổi nghiệp vụ.

Trạng thái gate 10/10/2026 (chi tiết [HANDOFF](HANDOFF.md), [VALIDATION](VALIDATION.md)): **G0** đạt (OAuth/PKCE/SDK, hai instance). **G1** login đã kiểm cho một tài khoản môi giới (login-v2 → matrix → verify-sotp → identity → cây quyền, chạy từ Vercel); role thường/ngoài allowlist và đa phiên chưa thử. **G2**: 39/42 operation bật theo quyết định của Đại ca — fieldMap từ shape live hoặc doc-only khi mẫu rỗng, đơn vị gắn unverified (nhánh "ghi rõ" của AGENTS.md), coverage chi tiết ở TEST-MAP; 3 operation tắt vì thiếu mẫu/route bị từ chối. **G3** một phần (security/regression synthetic; load/drill chưa). **G4** Claude đã kiểm login/tools và gọi live 39/39; expiry/disconnect live còn mở, GPT chưa thử. **G5** production đang chạy cho 1 thành viên; mở rộng team sau khi thêm allowlist và nghiệm thu GPT. Các bước dưới là tiêu chí thiết kế gốc để đối chiếu.

## G0 — nền tảng và OAuth spike

1. Tạo repository riêng từ folder này; giữ source-manifest và các cấu hình ứng viên. Chưa tạo cloud account/gói nếu chưa được Đại ca giao.
2. Chọn Node được Vercel hỗ trợ, kiểm npm registry, tạo package/lockfile với TypeScript, Zod, official MCP SDK/handler, Decimal implementation và thư viện OAuth AS.
3. Tạo handler Streamable HTTP stateless, 2 metadata tools, error boundary và correlation ID. Không bật SHA read route.
4. OAuth AS prototype: authorization code + PKCE S256, resource/audience MCP, metadata, đăng ký client, consent, revoke và adapter lưu trữ dùng chung. Fake identity và fake SHA trong test.
5. Chạy native Node ESM import, synthetic OAuth flow, two-instance replay test; sau khi có quyền deploy thì chạy Vercel preview.

**Exit G0:** SDK client initialize/list/call hoạt động; request không token bị challenge đúng; code bị dùng lại/PKCE sai/audience sai bị từ chối; OAuth adapter atomic consume hoạt động trên 2 instance; không phụ thuộc RAM. Nếu `oidc-provider` không phù hợp runtime, ghi ADR đổi thư viện/AS được hỗ trợ rồi lặp G0, không tự viết OAuth protocol.

## G1 — login SHA, identity và session store

1. Schema private cơ sở và migration 002 đã áp dụng theo yêu cầu bổ sung của Đại ca, xem CLOUD-SETUP/SUPABASE. Repository/RPC, encryption runtime, TTL và generation fence đã triển khai; kiểm chứng synthetic ghi tại VALIDATION. Tách store/keys preview khỏi production và cấu hình cleanup scheduler vẫn còn mở; thay đổi schema tiếp theo dùng migration tăng phiên bản.
2. Xây trang ID/password, challenge matrix và OTP. Không làm login tool. Bind browser cookie, auth transaction, client/redirect/resource/PKCE và SHA challenge.
3. Implement 3 auth calls từ [AUTH-AND-SESSIONS](AUTH-AND-SESSIONS.md). Dùng contract synthetic trước; fresh login chỉ khi người dùng tự thao tác form và được phép sử dụng tài khoản test.
4. Kiểm khác biệt `Bearer null`/không Authorization trên public auth, otpType thực nhận, TTL, mã lỗi OTP sai/hết hạn, verify timeout, nhiều login song song, logout SHA có ảnh hưởng phiên khác không.
5. Gọi get-user-login và account-no-and-rem để thiết lập scope. Đối chiếu danh tính SHA với allowlist nội bộ; thử người dùng thường, quản lý và người ngoài allowlist. Không dùng JWT decode đơn thuần làm chứng thực.
6. Lưu token mã hóa, revoke/disconnect, session generation fence. Refresh vẫn disabled cho tới có request/response/rotation semantics được chứng minh; hết hạn yêu cầu login lại.

**Exit G1:** login/OTP chạy từ Vercel preview tới SHA; user A không đọc phiên/tài khoản của B; logout chặn mọi request mới và response đang bay; bí mật không xuất hiện trong logs/model/browser storage. Nếu chỉ test được một role, rollout giới hạn role đã chứng minh.

## G2 — hợp đồng từng API và data quality

Mỗi route trong [catalog](api/ENDPOINTS.md) đi qua cùng quy trình, có thể chia lô nhưng không bỏ gate:

1. Đối chiếu source request builder và doc tại hash đã ghi. Route chỉ có tài liệu/null cần ghi trạng thái thiếu bằng chứng.
2. Implement strict input và builder allowlist method/path/query/body. Scope params do server resolve, không do model tự truyền.
3. Viết fixture synthetic cho success/nonempty/empty/null/error/malformed/pagination, cùng 5 test ID của operation.
4. Khi được phép live probe, dùng tài khoản test và API chỉ đọc; lấy cấu trúc đã khử PII/token để đối chiếu. Không lưu response thật chứa account data vào repo.
5. Kiểm quyền, đơn vị tiền/giá/khối lượng/tỷ lệ, khoảng ngày, envelope, paging, tổng lặp và scope drift. Ghi contract revision, response-schema hash, thời gian, role đã thử và trạng thái gate.
6. Chỉ bật operation khi tests, docs, mapping và fixture đều nhất quán. Operation còn thiếu trường thì giảm DTO rõ ràng hoặc giữ disabled; không trả suy đoán.

**Lô ưu tiên:**

| Lô | Operations | Đích nghiệm thu |
|---|---|---|
| A — bootstrap và hồ sơ | identity.current; accounts.tree/search/subaccounts; profile.information/detail | Scope đúng, PII mặc định tối thiểu, không đoán subId |
| B — tài sản cá nhân | assets.cash/stockValue/margin/loanSummary/loanDetail; portfolio.account | Tiền, giá, null và tổng lặp đúng |
| C — lệnh chỉ đọc | orders.history/unconfirmed; orderSummary.account/confirmations/transactions | Hai chế độ history/today, locale, username vs broker, period |
| D — tín dụng và tiền | loans.current/history/repayments; credit.guarantees/collateral; cash.movements | Composite key khoản vay, paging và distinct totals |
| E — quản lý | customers.overview; brokerAssets.summary/accounts/cash/portfolio; newAccounts.report; groups.list | Quyền cây môi giới, custid/mnId, nested members |
| F — nguồn bổ sung | research.summary/list; market.catalog/quote/price/ticks/candles; buyingPower.preview | Snapshot, units, buying-power input unit |
| H — thiếu shape | profile.authorized; orderSummary.top | Chỉ bật sau nonempty schema fixture |

MVP đầu tiên nên phát hành các operation của A/B đã đủ gate. Mục tiêu đầy đủ vẫn là toàn bộ route tra cứu có hợp đồng được xác minh, không ép lô H hoạt động bằng shape giả. Phải ghi rõ capability nào đang disabled trên UI và trong handoff.

## G3 — tích hợp, bảo mật và giới hạn tải

Thực hiện [TEST-PLAN](TEST-PLAN.md): cross-user scope, replay/CSRF/SSRF, schema rejection, deny-route, concurrent refresh/revoke, timeout/429, 20 người dùng mô phỏng bằng mock. Bắt đầu quota bảo thủ ở [TRANSPORT](api/TRANSPORT.md), điều chỉnh qua đo đạc không qua phỏng đoán giới hạn SHA.

**Exit G3:** không có critical finding về scope/token/mutation; secret scans sạch; dữ liệu partial hiển thị rõ; response size/duration trong budget; toàn bộ test của operation đang bật passed. Không dùng load test thật trên SHA khi chưa có cho phép riêng.

## G4 — preview và client acceptance

Sau khi Đại ca giao triển khai runtime: tạo/link dự án Vercel mới và dùng Supabase project hiện có của Đại ca, cấu hình secret qua giao diện/secret manager; thực hiện migration tăng phiên bản đã review, deploy preview và xem [DEPLOYMENT](DEPLOYMENT.md).

Test hai client mục tiêu Claude và GPT với tài khoản/plan thực: discovery → đăng nhập SHA → OTP → consent → tools/list → query đúng scope → hết hạn → reconnect → disconnect. Không giả định mọi client hỗ trợ cùng registration flow hoặc menu UI. Nếu client cần client_id/secret hoặc cơ chế đăng ký cụ thể, dùng cấu hình chuẩn của OAuth library và cập nhật tài liệu kết nối theo kiểm chứng lúc đó.

**Exit G4:** cả client được tuyên bố hỗ trợ có biên bản nghiệm thu; trường hợp chưa test ghi rõ unsupported/unverified, không quảng cáo đã chạy.

## G5 — production và bàn giao

Phạm vi production phải do yêu cầu triển khai của Đại ca xác lập. Tạo domain/issuer ổn định, promote artifact đã kiểm, kiểm DNS/metadata/TLS/DB migration/health và smoke read-only. Bật capability theo allowlist đã nghiệm thu, khoảng 2–3 người canary rồi mở team khi đạt điều kiện. Không tự mua gói trả phí.

**Exit G5:** rollback/revoke được thử, hướng dẫn sử dụng hiện hành, quyền admin/store/secrets đã bàn giao, mọi probe có ngày/commit/environment/result, HANDOFF nêu đúng thứ đã chạy.

## Các vấn đề phải đóng trước tính năng tương ứng

| ID | Vấn đề | Cách chốt | Ảnh hưởng |
|---|---|---|---|
| Q01 | Auth header/otpType/error semantics | Fresh browser login qua backend + sanitized contract | G1 |
| Q02 | Refresh body/rotation | Bằng chứng endpoint và test refresh/replay; nếu thiếu dùng re-login | Tự động gia hạn |
| Q03 | Tree quyền và nhiều phiên SHA | So sánh 2 role, token replacement, revoke | Mọi báo cáo tài khoản |
| Q04 | subNo/subId, remNo/emNo | Test mapping đúng từng route | Scope và độ đúng |
| Q05 | Price/ratio/tick time units | Đối chiếu cùng giao dịch/UI nguồn | Các số liệu liên quan |
| Q06 | Null-only/nonempty/nested rows | Fixture không rỗng đã khử nhạy cảm | profile.authorized, orderSummary.top và nested DTO |
| Q07 | custid/mnId và ngày báo cáo | Current request builder + bounded live query | newAccounts, sum-transaction |
| Q08 | OAuth library + Vercel + clients | G0 và G4 spike, không lý luận thay test | Kết nối end to end |
| Q09 | Source Swagger 69 path chưa cùng Gateway | Giữ inventory hold; thêm ADR/contract riêng nếu mở rộng | Không nằm trong MVP |

Không cần gửi mật khẩu/OTP vào chat để làm các bước trên. Khi implementation cần môi trường, người dùng nhập trên form hoặc cấu hình secret trong môi trường của mình.

Bổ sung 11/10/2026: từ điển enum/status từ SHA PC đã có runtime (metadata tool và meta.codeDictionary), 67 synthetic tests passed. Đây không đóng gate xác minh từng mã/đơn vị: source-ui-unverified và source-inferred phải giữ caveat; mã chưa có nghĩa giữ raw. Provenance ở SOURCE-MAP và coverage ở api/TEST-MAP.
