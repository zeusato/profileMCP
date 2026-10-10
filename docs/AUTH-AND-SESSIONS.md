# Đăng nhập SHA và phiên MCP

Checkpoint 10/10/2026: đã implement control plane và OAuth, 14 tests synthetic tổng thể passed; chưa live login SHA. Claude lỗi DCR trước form (đã sửa và deploy 10/10, chờ Connect lại), GPT chưa test. Quyết định runtime/các khác biệt còn thiếu ghi trong [HANDOFF](HANDOFF.md); các flow dưới là hợp đồng mục tiêu, không tự chứng minh live acceptance.

## 1. Hai lớp xác thực

Client MCP dùng **token do Profile MCP cấp**. Backend giữ **bearer SHA được mã hóa** để gọi upstream. Token của lớp này không được dùng thay token lớp kia. Đây là OAuth authorization code với PKCE S256 theo thiết kế MCP; tài liệu chuẩn yêu cầu resource server xác thực token phù hợp resource/audience và công bố metadata. [MCP Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).

Website đăng nhập là nơi duy nhất nhận ID/password/OTP. Model không thấy những trường này và không có tool login/verify/refresh/logout. Người dùng có thể disconnect trên website; thao tác quản lý phiên không thay đổi tài khoản/giao dịch SHA.

## 2. Luồng end to end

```mermaid
sequenceDiagram
  participant C as Client MCP
  participant W as Profile MCP web/OAuth
  participant D as Supabase
  participant S as SHA Gateway
  C->>W: Request /api/mcp
  W-->>C: 401 + protected resource metadata
  C->>W: authorize + state + PKCE + resource
  W->>D: Bind auth transaction, client, redirect, resource, browser nonce
  W-->>C: Mở website login
  Note over W,S: Người dùng nhập ID/password trên website
  W->>S: POST login-v2
  S-->>W: sessionKey + otpType capabilities
  W->>S: POST generate-matrix
  S-->>W: transactionId + otpIndex + TTL
  W->>D: Lưu challenge bí mật mã hóa, không lưu password
  Note over W,S: Người dùng nhập OTP trên website
  W->>S: POST verify-sotp
  S-->>W: SHA access/refresh token + expiry
  W->>S: GET get-user-login + account-no-and-rem
  W->>D: Identity allowlist, scope, encrypted SHA session
  W-->>C: Consent rồi redirect authorization code
  C->>W: Code + PKCE verifier
  W-->>C: Token Profile MCP
  C->>W: Gọi tool bằng token MCP
  W->>D: Kiểm subject/grant/session/generation/scope
  W->>S: Chỉ request tra cứu đã allowlist
  W-->>C: DTO tối thiểu + unit + coverage
```

Consent phải hiển thị đúng client, tài khoản SHA hiện tại và phạm vi đọc. Không tự đồng ý client mới dựa vào đăng nhập sẵn. Browser interaction cookie HttpOnly, Secure, SameSite thích hợp luồng redirect; mọi form POST có CSRF token và kiểm Origin. Redirect URI so khớp chính xác đăng ký, không wildcard tùy ý.

## 3. Contract SHA — G1 kiểm local 10/10/2026

Host cố định `https://api.shs.com.vn`; prefix `/prod/v1/author-service/p/auth/`. Schema success vẫn cần check envelope trước khi đọc data.

Bằng chứng: scripts/trace-sha-login.ts chạy adapter production từ máy local (IP Việt Nam), Đại ca tự nhập ID/password/OTP, một tài khoản vai trò môi giới; cùng DevTools capture web gốc sha.shs.com.vn. Chỉ ghi tên field/kiểu, không giá trị. **Chưa xác minh từ egress Vercel.**

| Bước | Method/path | Body allowlist | Header bắt buộc | Response data đã thấy |
|---|---|---|---|---|
| A1 | POST login-v2 | username, password | Authorization: Bearer null (client chính thức gửi; local không gửi vẫn 200) | username (lặp lại kiểu chữ người gõ), sessionKey (UUID), trustDevice **null**, otpType mảng chuỗi ["5","2"] |
| A2 | POST generate-matrix | username, sessionKey, trustDevice, otpType nguyên giá trị A1 | Bearer null + **Session-Key = sessionKey**; thiếu thì HTTP 400 code "405" "Session hết hạn" | username, otpIndex (chuỗi), transactionId, note (chuỗi), remainSeconds (300) |
| A3 | POST verify-sotp | username, sessionKey, trustDevice, otpType=`2`, transactionId, otp | Bearer null + Session-Key (capture web gốc) | access_token, **refresh_token null**, token_type, expires_in (~8 giờ), refresh_expires_in |

Envelope auth: `{timestamp, code: "200", message, data}`; code là chuỗi; timestamp giờ địa phương không offset. Lỗi nghiệp vụ có thể là HTTP 400 kèm `code` khác và `traceId`. `otpType` "2" là SOTP/matrix; "5" chưa rõ nghĩa, không tự suy. Nếu không có "2", UI báo chưa hỗ trợ và dừng; không thử brute-force loại OTP. Origin/Referer không gửi từ backend (trình duyệt tự thêm ở web gốc, không phải contract app).

Sau A3 (Bearer = access_token): get-user-login envelope `{code, message, data}` (không timestamp), data mảng 1 dòng: branchCode, brokerCode, brokerName, preferredUsername (dạng chuẩn SHA, có thể khác kiểu chữ ID người gõ), saleGroupName, saleGroupNo, positionLevel, homeOrder, custodyCd. account-no-and-rem: data `{accounts[], brokers[]}`; accounts: accountNumber, customerName, brokerCode, remNo; brokers: brokerCode, brokerName, level, remNo, remMng, children (lồng), accounts. Runtime chỉ giữ accountNumber/brokerCode và cây brokerCode; customerName bị bỏ.

ID SHA không phân biệt hoa/thường: identity so khớp không phân biệt kiểu chữ rồi dùng preferredUsername của SHA; allowlist digest theo ID chữ thường (Store.member vẫn đọc bản ghi cũ đúng kiểu chữ).

Không coi capture token trong Electron là API đăng nhập server. Các interceptor `account_ipc.js` và browser storage của ứng dụng nguồn chỉ giải thích môi trường cũ; không port.

### Sau A3

- GET `/prod/v2/sha-service/e/user/get-user-login`: lấy danh tính authoritative, brokerCode, preferredUsername, branch và role/scope liên quan.
- GET `/prod/v2/sha-service/e/account/account-no-and-rem`: lấy scope được SHA trả cho token hiện tại. Không tự dựng scope từ input model.
- Đối chiếu user với allowlist nội bộ trước cấp MCP grant. Tài khoản SHA hợp lệ nhưng chưa được allowlist không có quyền truy cập Profile MCP.
- JWT decode chỉ để đọc metadata, không chứng minh chữ ký. Nếu chọn xác minh JWT tại backend: pin issuer SHA đã kiểm, allowlist JWKS URL, kiểm alg/kid/signature/aud/exp; `aud` và discovery/JWKS còn phải xác minh ở G1. Không fetch URL từ `iss` tùy ý trong token. Có thể dùng token mới do TLS login trả + authoritative API response để bootstrap khi JWT verification chưa được cấu hình, nhưng không nhận bearer SHA do client MCP tự đưa vào.
- `accessExpiresAt` lấy expiry do SHA chứng minh; nếu có cả exp và expires_in thì dùng giới hạn sớm hơn, trừ clock skew 60 giây (chính sách đề xuất). Không hardcode 8 giờ.
- Chưa có contract refresh được chứng minh; verify-sotp live 10/10/2026 trả refresh_token null. `/auth/refresh-token` chỉ được nhắc tên; **không gọi tự động**. Session hết hạn chuyển `reauth_required`. MCP refresh token chỉ gia hạn quyền MCP khi SHA session vẫn hợp lệ; nó không tự gia hạn SHA.

## 4. State machine và đồng thời

Auth transaction: `created → password_submitted → challenge_ready → verifying → succeeded`, hoặc `failed/expired/cancelled`. Password/OTP không ghi vào transaction; chỉ lưu challenge ciphertext cần cho bước sau.

- Claim bước verify bằng compare-and-swap trạng thái/version hoặc row lock ngắn; không giữ transaction DB suốt thời gian gọi mạng.
- Một OTP submission chỉ được thực thi bởi một worker. Double click nhận trạng thái đang xử lý, không gửi lại upstream.
- Nếu verify timeout, kết quả có thể không biết chắc. Không tự replay OTP; chuyển trạng thái cần bắt đầu lại hoặc kiểm chứng theo contract upstream đã biết.
- Challenge expire dựa remainSeconds từ SHA, với upper bound do ứng dụng đặt; xóa secret sau thành công/hết hạn. Không hardcode TTL upstream.
- Upstream session: `active → expired/reauth_required/revoked`; token replace tăng generation. Grant chỉ active nếu session cùng subject/team/generation còn active.
- Logout/disconnect revoke grant và session của connection tương ứng trong một transaction; request đang chạy phải check generation lại trước trả dữ liệu.
- Khi sau này bật refresh SHA: lock lease có expiry + fencing version, một refresh thực thi, lưu cặp access/refresh mới nguyên tử; token rotation thất bại không tái dùng refresh token cũ. Chỉ triển khai sau Q02.

## 5. OAuth AS và client registration

Dùng thư viện chuẩn có authorization code, PKCE S256, discovery, resource indicators, token endpoint, revocation và storage adapter. `oidc-provider` là ứng viên, chưa được quyết định/pin. G0 phải chứng minh chạy trên Vercel và persistence/atomic consume trong Supabase.

Expose protected-resource metadata, authorization-server metadata, authorize, token, revoke và endpoints thư viện yêu cầu. URL cuối phải khớp issuer production cố định. Client chưa đăng ký có thể dùng cơ chế pre-registration/CIMD/DCR mà thư viện và client thực hỗ trợ; lựa chọn cụ thể chốt tại G0/G4. Dynamic registration nếu bật cần quota và validation redirect/client metadata, không nhận URL nội bộ/localhost ngoài trường hợp localhost native client được chuẩn cho phép và đã thiết kế riêng.

MCP token phải bind client_id, subject, team, resource, scope, grant và session generation. Với opaque token: lưu digest HMAC, lookup server-side. Với JWT: kiểm chữ ký và claims, vẫn check revoke/session trong store. Token payload và cookie không chứa bearer SHA. [MCP security: token passthrough và confused deputy](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices).

TTL nội bộ đề xuất để kiểm thử, chưa phải thông số SHA: authorization code 60 giây và dùng một lần; access token MCP 10 phút nhưng không quá thời hạn session; rotating MCP refresh tối đa 7 ngày nhưng không vượt session SHA/revoke. Authorization-server library quản lý rotation/replay, adapter phải triển khai atomicity được test.

## 6. Phân quyền request

1. Xác minh token MCP, resource và scope.
2. Resolve user/team/connection/session còn active, phiên bản quyền hiện tại.
3. Resolve accountRef, brokerRef, subaccountRef tenant-bound. Reference opaque là tiện ích, không thay thế kiểm quyền.
4. Các brokerCode/remNo/emNo/tlId/custid upstream lấy từ danh tính và cây quyền; public input không có các field này.
5. Account thuộc broker được phép, subId thuộc account, filter ngày/range hợp lệ. Broker scope không rõ phải báo AMBIGUOUS_SCOPE, không lấy root đầu tiên.
6. Gọi route cố định; validate account/subaccount/broker trong response. Nếu nguồn không có đủ identity fields, đối chiếu bằng contract route và request binding đã nghiệm thu; không đoán từ dòng đầu.
7. Nested rows phải kiểm hoặc bỏ khỏi DTO. Pagination scope drift => lỗi, không xuất một phần dữ liệu trái quyền.
8. Check generation/revoke lần cuối rồi trả DTO.

Cache quyền gợi ý tối đa 60 giây, gắn session và version; thời hạn cụ thể là policy cần test. Trường hợp thay đổi quyền có yêu cầu thu hồi tức thời phải invalidate chủ động hoặc fetch mỗi request. Không tuyên bố revoke upstream tức thời nếu chỉ TTL cache.

## 7. Dữ liệu tối thiểu

Scope đề xuất: `profile.read`, `accounts.read`, `assets.read`, `orders.read`, `credit.read`, `reports.read`, `research.read`, `market.read`; `profile.pii` tách riêng và mặc định không cấp: trang consent hiện ô chọn riêng, không tick sẵn, chỉ khi client xin scope này; bỏ trống thì grant ghi profile.pii là rejected (tránh lặp consent) và token không có scope đó. Scope `openid` chỉ dùng nếu OAuth library thực triển khai OIDC, không tự thêm vì tên thư viện.

Runtime: 8 read scopes được khai báo cả ở AS (`scopes`, để DCR có `scope` của MCP client hợp lệ) và resource server; consent grant cùng tập ở hai phía. `openid` do oidc-provider luôn công bố nhưng không được cấp: authorization xin scope ngoài 8 read scopes nhận `invalid_scope` trước login SHA.

Log không chứa Authorization, cookie, username/password, OTP, access/refresh token, request/response body tài khoản. Audit chỉ operation, subject ID nội bộ/hmac, request ID, result code, duration, row count và gate version. Không đẩy PII vào analytics/tracing.
