# Contract MCP dự kiến

## Tool surface

17 tool nghiệp vụ, mỗi tool nhận `operation` enum và schema theo operation; thêm 2 tool metadata không gọi SHA. Không dùng một tool generic nhận URL/method/body. Danh mục đầy đủ và input chính xác nằm trong [ENDPOINTS](api/ENDPOINTS.md), [JSON Schema](../config/tool-input-schemas.json).

| Tool | Nội dung đọc |
|---|---|
| get_profile_identity | Danh tính SHA hiện tại |
| list_managed_accounts | Cây quyền, danh sách tài khoản, tiểu khoản |
| get_account_profile | Hồ sơ và trạng thái tài khoản; PII hạn chế |
| get_customer_overview | Tổng quan khách hàng theo kỳ |
| get_account_assets | Tiền, chứng khoán, margin và tổng nợ tiểu khoản |
| get_account_portfolio | Danh mục chứng khoán tiểu khoản |
| get_broker_assets | Tổng tài sản/tiền/danh mục trong phạm vi môi giới |
| get_credit_risk | Thông tin bảo lãnh, bổ sung tài sản và giải chấp dạng báo cáo |
| get_loan_records | Món vay, lịch sử món vay và lịch sử thu nợ |
| get_order_records | Lịch sử/sổ lệnh đọc, lệnh chờ xác nhận |
| get_order_summary | Tổng hợp giao dịch/lệnh |
| get_buying_power | Tra cứu sức mua theo giá giả định; chỉ bật sau xác minh unit |
| get_cash_movements | Báo cáo nộp/rút; không nộp/rút tiền |
| get_new_accounts_report | Báo cáo tài khoản mở mới; không mở tài khoản |
| get_research | Danh sách và tổng hợp khuyến nghị nguồn |
| list_customer_groups | Đọc nhóm và thành viên được phép |
| get_sha_market_data | Danh mục mã, giá, giao dịch gần nhất và nến |
| list_profile_capabilities | Operation thực sự đã bật cho user, giới hạn và gate |
| get_profile_data_dictionary | Đơn vị, nguồn, enum, null và định nghĩa chỉ tiêu |

Một tool chỉ đăng ký những nhánh schema đã được bật; nếu chưa có operation nào thì không đưa tool đó vào tools/list. `readOnlyHint:true`, `destructiveHint:false`, `openWorldHint:true` là metadata; quyền và an toàn do runtime allowlist/policy thực thi.

## Input chung

Strict object, additionalProperties=false. Không tự upper-case hoặc sửa mã sai, đảo from/to, ép kỳ thiếu thành hiện tại. Kiểm ngày thực tồn tại, timezone, range hợp lệ, giới hạn danh sách và decimal string. `mode=today` có ý nghĩa rõ trong orders.history, không là default ngầm cho history thiếu ngày.

`accountRef`, `subaccountRef`, `brokerRef` là reference server cấp, bound vào user/team/session generation; trả số tài khoản che bớt chỉ để người dùng nhận biết. Nhập mã tài khoản thật trực tiếp nếu bổ sung sau phải lookup và kiểm cùng quyền; không chỉ kiểm regex.

Nếu thiếu brokerRef mà identity có nhiều root hợp lệ, báo AMBIGUOUS_SCOPE và danh sách reference được phép; không dùng root đầu tiên. accountRefs absent trong báo cáo broker nghĩa phạm vi broker đã chọn, không toàn bộ hệ thống. accounts=null và [] upstream không tự hoán đổi.

## Output envelope

`structuredContent` có schema chính thức khi implementation; `content` chỉ chứa tóm tắt ngắn nhất quán. Không chỉ serialize raw JSON vào text. Mẫu dưới **hoàn toàn synthetic**, không chứa tài khoản thật:

```json
{
  "schemaVersion": "1",
  "operation": "assets.cash",
  "status": "ok",
  "data": {"cashTotal": "12500000.00", "cashHold": null},
  "meta": {
    "provider": "SHA",
    "sourceOperation": "assets.cash",
    "fetchedAt": "2026-10-09T03:00:00Z",
    "sourceTimestamp": null,
    "businessDate": null,
    "scope": {"accountRef": "acct_synthetic_A", "subaccountRef": "sub_synthetic_A"},
    "units": {"cashTotal": {"unit": "VND", "status": "verified"}},
    "coverage": {"complete": true, "reason": "single-record-contract", "returned": 1},
    "warnings": [],
    "requestId": "00000000-0000-4000-8000-000000000001"
  }
}
```

`verified` trong ví dụ chỉ minh họa contract sau G2, không khẳng định route đã được xác minh. Tiền/giá dùng canonical decimal strings, không JavaScript float cộng dồn. Null giữ nguyên; missing có warning/field availability riêng. Ngày chưa rõ nghĩa để null/sourceRaw trong dictionary, không lấy fetchedAt thay.

Mỗi danh sách trả `returned`, `total` nếu nguồn có, `complete`, `nextCursor`, `truncated`, `reason`, `pagesFetched`, `totalsScope` (allMatched/page/unknown). Một page có 50/10000 dòng không được ghi complete=true. Totals nguồn có thể toàn kỳ dù items chỉ một page, phải nói rõ.

Source timestamp dùng thời gian giá/giao dịch thật có chứng cứ; SHA HTTP response timestamp chỉ là thời gian xử lý server, đặt `upstreamResponseAt` nếu cần, không tự coi là thời điểm phát sinh dữ liệu. Không có timestamp => null.

## Error contract

Sai protocol/schema trước dispatch dùng lỗi chuẩn SDK thích hợp. Lỗi nghiệp vụ/upstream dùng tool result `isError:true` và mã ổn định, không HTTP 200 với data=[] giả thành công. Không trả upstream body chứa PII hoặc stack trace cho model.

| Code | Khi dùng | Retry |
|---|---|---|
| INVALID_INPUT | Sai schema, ngày, enum, số hoặc range | Sửa input |
| UNAUTHENTICATED | Token MCP thiếu/sai/hết hạn | OAuth challenge ở transport |
| REAUTH_REQUIRED | Phiên SHA không còn hợp lệ | Mở trang reconnect từ UI; không gửi OTP cho model |
| FORBIDDEN_SCOPE | Tài khoản/broker/subaccount ngoài quyền | Không retry với scope rộng hơn |
| AMBIGUOUS_SCOPE | Chưa rõ root hoặc account | Chọn reference hợp lệ |
| CAPABILITY_UNAVAILABLE | Operation chưa qua gate/tạm tắt | Không gọi route khác thay |
| UPSTREAM_AUTH_FAILED | SHA trả lỗi auth | Mark session cần kiểm/reauth; không đổi bearer |
| UPSTREAM_REJECTED | Envelope báo lỗi nghiệp vụ | Theo mã đã mapping, không retry mù |
| UPSTREAM_SHAPE_CHANGED | Shape/kỳ/paging trái contract | Quarantine operation, giữ null semantics |
| RATE_LIMITED | Quota local hoặc SHA 429 | Retry-After có giới hạn |
| UPSTREAM_TIMEOUT | Vượt deadline | Retry read theo policy |
| STORE_UNAVAILABLE | Không kiểm được session/quyền | Fail closed |

Partial chỉ dùng cho dữ liệu được phép nhưng chưa lấy hết; scope mismatch, auth failure hoặc shape nền tảng sai phải là lỗi. Data dictionary ghi rõ enum raw chưa biết; không tạo label “an toàn” cho status chưa gặp.
