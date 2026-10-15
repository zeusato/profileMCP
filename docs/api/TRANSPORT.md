# SHA transport và giới hạn truy vấn

## Phản hồi tool MCP

Mọi tool trả cùng dữ liệu ở `structuredContent` và `content: [{ type: "text", text: JSON.stringify(data) }]`, theo [MCP structured content](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#structured-content). Client chỉ chuyển phần text cho model vẫn đọc được toàn bộ kết quả. Áp dụng cho 2 tool metadata và toàn bộ tool nghiệp vụ; capabilities phải có danh sách operation, không chỉ số lượng.

Chỉ serialize DTO sau kiểm quyền, lọc PII và session fence; giữ null, chuỗi decimal, refs, meta/warnings/coverage/pagination. Không serialize raw upstream hoặc token. Lỗi cũng có JSON ở cả hai phần, giữ `isError: true`, chỉ chứa mã lỗi an toàn và requestId. Không thay đổi scopes, schema input hay phiên OAuth.

KMS đã deploy 15/10/2026: cả text JSON và structuredContent có cùng Content, contentImages, contentLinks và contentPart. Giữ đường dẫn ảnh trong JSON không yêu cầu tải ảnh hay gửi MCP image block. Nội dung dài được phân phần qua nextCursor, không mất đuôi; cursor chỉ lưu offset/digest, kiểm lại quyền và fingerprint nguồn mỗi lần. Chi tiết hợp đồng tại [ENDPOINTS](ENDPOINTS.md#knowledge.documents).

## Allowlist

Chỉ `https://api.shs.com.vn`, cổng HTTPS mặc định, method/path chính xác từ config. Tách HTTP client auth control plane và read client. Read client không được import auth write builder hoặc order mutation builder. Tắt redirect tự động; response redirect tới host/path khác là lỗi, không forward bearer. Không nhận URL, headers hoặc raw body từ model.

Prefix Gateway đã có bằng chứng:

- `/prod/v1/author-service/p/auth/`: login control plane.
- `/prod/v2/sha-service/e/`: user, account, asset, order, market, performance.
- `/prod/v2/sha-system/e/`: trading snapshot.
- `/prod/v2/sha-advice/e/`, `/prod/v2/sha-customer/e/`, `/prod/v2/advisor-service/e/`: route cụ thể trong catalog.

Swagger `/i/v1/...` và `/t/v1/...` là path nguồn nội bộ, không gọi nguyên xi trên Gateway và không tự replace prefix để bật toàn bộ API. Method là một phần khóa route: GET và POST `asset/loan-info` có nghĩa khác nhau.

## Headers và envelope

Read client gắn SHA bearer đúng session; Accept JSON, Accept-Language vi, Correlation-Id UUID mỗi request. Auth control plane gửi `Authorization: Bearer null` như client chính thức và thêm `Session-Key` (sessionKey của login-v2) cho generate-matrix/verify-sotp; xem AUTH-AND-SESSIONS §3. Referer `https://sha.shs.com.vn` được nguồn cũ mô tả nhưng cần fresh probe xác minh điều kiện thực; không giả mạo fingerprint Electron. Không forward auth MCP hoặc arbitrary header từ client sang SHA.

SHA có code string `"200"` và numeric `200`; chỉ success theo schema của endpoint. Không chấp nhận mọi 2xx hoặc mọi code=0. Discovery `stock/list-order-type` có code=0 riêng và vẫn disabled. TradingView history là flat UDF, phải parser riêng.

HTTP/envelope/shape/identity/date đều phải hợp lệ. HTTP 200 + auth error không phải dữ liệu rỗng. Business result không phải HTML login page; content type và payload size có giới hạn. Request/response sensitive bodies không đi vào logging tự động.

## Ngày, giá và kiểu số

MCP nhận ISO date `YYYY-MM-DD`; builder convert sang `YYYYMMDD` cho business report đúng route. Dùng Asia/Ho_Chi_Minh cho ngày giao dịch; không `toISOString().slice(0,10)` từ local midnight. Date-time phải có offset; TradingView from/to là epoch **seconds**.

Ngày from/to paired và from≤to. Chính sách ban đầu giới hạn report 31 ngày/lần, nến daily 366 ngày/lần; đây là budget của Profile MCP, không khẳng định SHA chỉ hỗ trợ từng ấy. Input vượt budget báo lỗi hướng dẫn chia kỳ, không cắt ngày ngầm.

Numeric string parser theo field/route. Chuỗi vi-VN và decimal dot không dùng chung parser tự đoán. Preserve dấu âm, 0, null và số lớn. Không parseFloat mọi response. Không đổi kVND → VND ngoài trường đã xác minh.

## Pagination

Adapter riêng cho từng shape: `{page,size,totalElements,totalPages,data/list}`, hoặc `{pageNo,pageSize,totalCount,totalPage,content}`. Kiểm base page thực tế, số nguyên không âm, rows không vượt size, cursor monotonic; phát hiện trang lặp và total thay đổi. Không chỉ vòng lặp đến khi empty trong nguồn đang biến động.

Default một page 50 rows, limit tối đa 100. Public cursor opaque có MAC/digest, bind subject/team/operation/filter hash/session generation/expiry. Model không truyền raw upstream page với filter cũ. Các endpoint không có paging không tự chế upstream cursor; output cắt có cảnh báo, hoặc reject quá lớn nếu không thể trả an toàn.

Tổng hợp toàn kỳ chỉ khi đã lấy đầy đủ, dedup theo key đúng và total nguồn nhất quán; nếu không, trả totals nguồn với scope/coverage rõ hoặc partial subtotal được gắn nhãn. Không cộng repeated totals của nhiều page. Entitlement fetch không đủ phải fail closed cho quyền, không chấp nhận partial như “toàn bộ tài khoản”.

## Budget đề xuất ban đầu

| Hạng mục | Giá trị thử nghiệm | Ghi chú |
|---|---|---|
| Upstream timeout read | 8 giây/request | Tune theo đo đạc |
| Tool deadline | 20 giây | Thấp hơn runtime maxDuration thực |
| Concurrency mỗi user | 2 request SHA | Quota shared store |
| Concurrency project | 10 request SHA | Không load test SHA khi chưa được phép |
| Tool rows/page | 50 default, 100 max | Không full-universe claim |
| Fan-out mỗi tool call | 4 request | Gộp nhiều endpoint phải giới hạn |
| Response business JSON | 128 KiB | Cắt có coverage hoặc lỗi vượt budget |
| Raw upstream body | 2 MiB | Giới hạn stream trước parse |
| Retry read | Tối đa 1 với backoff+jitter trong deadline | Chỉ transport/429/5xx đã chứng minh an toàn |

Read POST được retry chỉ khi contract xác minh idempotent query. Auth login/generate/verify không auto-retry, refresh chưa bật. Không retry 401/403 thành user khác, không đổi route để né lỗi.

Lấy snapshot tại thời điểm request. Không poll nền, socket, tự lưu warehouse hoặc đồng bộ toàn bộ team vào DB trong phạm vi dự án này.
