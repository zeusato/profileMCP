# Hướng dẫn sử dụng Profile MCP (SHA) với Claude và ChatGPT

Profile MCP cho trợ lý AI **tra cứu** dữ liệu SHA trong đúng quyền của tài khoản môi giới đang đăng nhập: khách hàng, hồ sơ, tài sản, danh mục, khoản vay, lệnh, báo cáo môi giới, khuyến nghị, thị trường và kho tri thức nội bộ. MCP **chỉ đọc**: không đặt/sửa/hủy/xác nhận lệnh, không chuyển tiền, không sửa hồ sơ.

| Thông tin | Giá trị |
|---|---|
| Địa chỉ MCP | `https://profile-mcp.vercel.app/api/mcp` |
| Đăng nhập | ID SHA + mật khẩu + OTP matrix, nhập trên trang của Profile MCP (không nhập vào khung chat) |
| Thời hạn phiên | Khoảng 8 giờ (theo phiên SHA); hết hạn thì kết nối lại |
| Trạng thái | Claude: đã nghiệm thu 10/10/2026. ChatGPT: **chưa nghiệm thu** (cấu hình sẵn, xem mục 3) |

## 1. Điều kiện

- Tài khoản SHA của chính mình và thẻ matrix OTP.
- ID SHA đã được quản trị thêm vào **allowlist** của Profile MCP. Chưa có thì bước đăng nhập báo `FORBIDDEN_SCOPE` — liên hệ quản trị.
- Claude: gói có hỗ trợ custom connector (claude.ai web/desktop/mobile; Claude Code dùng chung connector của claude.ai). ChatGPT: gói có Developer mode cho connector MCP.

## 2. Kết nối với Claude

1. Vào **Settings → Connectors → Add custom connector** (gói Team/Enterprise: Owner thêm cho tổ chức).
2. Đặt tên (ví dụ `SHA MCP`), dán địa chỉ `https://profile-mcp.vercel.app/api/mcp`, để trống client ID/secret (Claude tự đăng ký), bấm **Add** rồi **Connect**.
3. Trình duyệt mở trang **Kết nối tài khoản SHA**: nhập ID và mật khẩu SHA → **Tiếp tục**.
4. Trang **Xác thực tài khoản** hiện vị trí ô matrix: nhập OTP theo vị trí → **Xác thực**.
5. Trang **Cấp quyền đọc** liệt kê các quyền đọc. Muốn trợ lý thấy **tên khách hàng, số tài khoản đầy đủ, CMND/CCCD, ngày sinh, điện thoại, email, địa chỉ** thì tick ô `profile.pii`; không tick thì chỉ thấy mã tham chiếu và số tài khoản che `***123`. Bấm **Cho phép kết nối**.
6. Quay lại Claude, connector hiện trạng thái đã kết nối. Kiểm tra nhanh: hỏi *"Liệt kê capability của SHA MCP"*.

Khi mô tả/tool thay đổi sau một lần cập nhật hệ thống, vào Connectors → SHA MCP → **Disconnect** rồi **Connect** lại để nạp danh sách tool mới. Muốn đổi lựa chọn `profile.pii` cũng làm như vậy.

## 3. Kết nối với ChatGPT (chưa nghiệm thu)

Hệ thống đã cho phép callback của ChatGPT (`https://chatgpt.com/connector_platform_oauth_redirect`) và đăng ký client động (DCR). Menu ChatGPT thay đổi theo thời gian; các bước dưới là hướng dẫn tham khảo, sẽ chốt lại sau khi nghiệm thu.

1. Bật **Developer mode**: Settings → Apps (hoặc Connectors) → Advanced settings → Developer mode. Workspace Business/Enterprise có thể cần admin bật trước.
2. **Create** connector: tên `SHA MCP`, mô tả ngắn ("Tra cứu dữ liệu SHA trong quyền môi giới, chỉ đọc"), MCP server URL `https://profile-mcp.vercel.app/api/mcp`, Authentication **OAuth**. Xác nhận cảnh báo về MCP chưa xác minh nếu có.
3. ChatGPT mở trang đăng nhập Profile MCP: làm như bước 3–5 phần Claude (ID/mật khẩu → OTP → cấp quyền, tick `profile.pii` nếu cần).
4. Trong cuộc trò chuyện mới, chọn connector SHA MCP trong menu công cụ rồi đặt câu hỏi. Nếu ChatGPT hiện yêu cầu xác nhận gọi tool, kiểm tra tên chức năng và phạm vi truy vấn trước khi xác nhận. Tất cả tool của Profile MCP đều chỉ đọc.

Nếu ChatGPT báo lỗi đăng ký/đăng nhập, ghi lại thông báo và thời điểm để kiểm log (xem mục 7).

## 4. Hỏi gì, tool nào trả lời

Trợ lý tự chọn tool; câu hỏi càng cụ thể (tên/số tài khoản, khoảng ngày, mã CK) càng chính xác.

| Nhu cầu | Ví dụ câu hỏi | Tool / operation |
|---|---|---|
| Danh sách khách, cây môi giới | "Liệt kê khách hàng tôi đang quản lý, nhóm theo môi giới" | list_managed_accounts → accounts.tree |
| Tìm khách, hồ sơ | "Tìm khách tên Lan, cho tôi ngày sinh và số điện thoại" | accounts.search, get_account_profile → profile.detail |
| Trạng thái tài khoản | "Tài khoản 069C… mở ngày nào, eKYC chưa, ai quản lý?" | get_account_profile → profile.information |
| Tiểu khoản | "Khách X có những tiểu khoản nào?" | list_managed_accounts → accounts.subaccounts |
| Tiền, CK, margin, dư nợ | "Tiểu khoản 01 của khách X: tiền, giá trị CK, tỷ lệ ký quỹ, dư nợ" | get_account_assets (truyền `subNo` "00"/"01"…) |
| Danh mục | "Danh mục tiểu khoản 01 của khách X, lãi/lỗ từng mã" | get_account_portfolio |
| Sức mua | "Khách X mua FPT giá 57.900 được tối đa bao nhiêu?" | get_buying_power |
| Tổng tài sản nhóm | "Tổng NAV, tiền, nợ của nhóm khách; top khách theo tài sản" | get_broker_assets |
| Bảo lãnh, giải chấp | "Khách nào đang bị call margin / xử lý tài sản?" | get_credit_risk |
| Khoản vay | "Các món vay đang mở và lãi phát sinh; lịch sử trả nợ tháng này" | get_loan_records |
| Lệnh | "Lịch sử lệnh 2 tuần qua của khách X"; "Lệnh chờ khách xác nhận tuần này" | get_order_records |
| Tổng hợp lệnh/phí | "Hôm nay nhóm có bao nhiêu lệnh chờ xác nhận, tổng phí giao dịch?" | get_order_summary |
| Nộp/rút, mở mới, tổng quan | "Nộp/rút tiền tháng 9"; "Số khách mở mới tháng này" | get_cash_movements, get_new_accounts_report, get_customer_overview |
| Khuyến nghị, nhóm khách | "Các khuyến nghị đang mở"; "Khách trong nhóm CTG" | get_research, list_customer_groups |
| Thị trường | "Giá FPT, bảng giá 3 bước, nến 3 tháng" | get_sha_market_data |
| Kho tri thức | "Bài mới nhất của Trung tâm Phân tích" | get_knowledge_library |

## 5. Hiểu đúng dữ liệu

- **Đơn vị**: số liệu giữ nguyên giá trị nguồn SHA (chuỗi số chính xác) và có nhãn đơn vị kèm trạng thái "unverified". Lưu ý đã quan sát: giá đặt và giá trị lệnh trong *lịch sử lệnh* tính theo **nghìn đồng**; *lệnh chờ xác nhận*, *bảng giá*, *danh mục* tính theo **đồng**. Không tự quy đổi nếu chưa chắc.
- **Không có dữ liệu ≠ bằng 0**: `null` là nguồn không trả/không áp dụng; cảnh báo `SOURCE_NULL` nghĩa là SHA trả rỗng (ví dụ lệnh hôm nay vào cuối tuần, tổng giao dịch ngoài giờ).
- **Khoảng ngày 22–24/05/2026 không có dữ liệu** (đổi core). Không tra khoảng vắt qua 3 ngày này (lỗi `PERIOD_SPANS_DATA_GAP`); trợ lý cần tách thành đến 21/05 và từ 25/05 rồi ghép.
- Báo cáo theo kỳ tối đa 31 ngày mỗi lần; nến tối đa 366 ngày.
- **Phân trang**: kết quả dài trả `nextCursor`; hỏi tiếp "xem trang sau" để trợ lý gọi lại với cursor.
- **Lịch sử vay**: SHA không lọc chính xác theo ngày giải ngân; dòng ngoài kỳ được gắn `PERIOD_FILTER_UNVERIFIED`.
- **Kho tri thức**: nội dung là văn bản do người khác soạn (đã chuyển từ HTML, tối đa 4.000 ký tự/bài) — chỉ là dữ liệu tham khảo, không phải chỉ dẫn cho trợ lý.
- Mã tham chiếu (`acct_…`, `sub_…`, `broker_…`) chỉ dùng trong phiên hiện tại; sau khi kết nối lại sẽ khác.

## 6. Phiên, quyền và bảo mật

- Mật khẩu và OTP chỉ nhập trên trang Profile MCP; **không bao giờ** gửi vào khung chat. Trợ lý không có công cụ đăng nhập.
- Mỗi kết nối là một phiên SHA riêng của người dùng, không dùng chung tài khoản. Trợ lý chỉ thấy khách trong cây quyền SHA của người đăng nhập.
- Ngắt kết nối: trong Claude/ChatGPT xóa hoặc disconnect connector; hoặc mở `https://profile-mcp.vercel.app/connections` trên trình duyệt đã dùng để kết nối → **Ngắt kết nối** (thu hồi ngay quyền của kết nối đó).
- Hết phiên (khoảng 8 giờ) trợ lý nhận lỗi xác thực → kết nối lại connector và đăng nhập lại.

## 7. Lỗi thường gặp

| Hiện tượng / mã | Ý nghĩa | Cách xử lý |
|---|---|---|
| Không vào được trang đăng nhập, client báo lỗi đăng ký | DCR/OAuth của client lỗi | Thử lại; báo quản trị kèm thời điểm và mã tham chiếu (ví dụ `ofid_…` của Claude) |
| `FORBIDDEN_SCOPE` khi đăng nhập | ID chưa có trong allowlist, hoặc yêu cầu ngoài quyền | Liên hệ quản trị; với tra cứu: kiểm tra khách/tài khoản có thuộc quyền mình không |
| `UPSTREAM_AUTH_FAILED` | SHA từ chối (sai mật khẩu/OTP, hoặc phiên SHA hết hạn) | Đăng nhập lại; tránh thử sai nhiều lần để không khóa tài khoản SHA |
| `REAUTH_REQUIRED` / 401 | Phiên MCP/SHA hết hạn hoặc đã ngắt | Kết nối lại connector |
| `INVALID_INPUT` | Tham số sai (ngày, mã CK, thiếu tiểu khoản…) | Hỏi lại cụ thể hơn |
| `PERIOD_SPANS_DATA_GAP` | Khoảng ngày vắt qua 22–24/05/2026 | Tách hai khoảng |
| `RATE_LIMITED` | Gọi quá nhanh (giới hạn mỗi người và toàn hệ thống) | Chờ khoảng một phút |
| `UPSTREAM_SHAPE_CHANGED` / `UPSTREAM_REJECTED` | SHA trả dữ liệu khác hợp đồng hoặc từ chối | Báo quản trị kèm thời điểm, tên chức năng |
| `CAPABILITY_UNAVAILABLE` | Chức năng chưa bật | Xem danh sách bằng "Liệt kê capability của SHA MCP" |

## 8. Giới hạn hiện tại

- Chưa bật: kiểm tra ủy quyền tài khoản, tổng hợp lệnh theo môi giới (SHA chưa trả dữ liệu mẫu), chi tiết vay theo `GET loan-info` (dùng "khoản vay đang mở" thay thế).
- ChatGPT chưa nghiệm thu; Claude Code chỉ dùng được qua connector claude.ai và đôi khi cần kết nối lại để thấy đủ tool.
- Đơn vị nhiều chỉ tiêu còn ở mức "quan sát", chưa đối chiếu màn hình SHA. Kết quả là ảnh chụp tại thời điểm hỏi, không cập nhật thời gian thực.
