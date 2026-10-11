# Dữ liệu, mâu thuẫn nguồn và điều kiện bật tool

## Thứ tự bằng chứng

Contract mới được kiểm chứng bằng request/response read-only, role và thời gian cụ thể → code hiện hành tại commit ghi trong source manifest → tài liệu API → Swagger/discovery. Bằng chứng ở ngày cũ không chứng minh production hôm nay. Nếu hai nguồn mâu thuẫn, ghi gate; không chọn giá trị tiện nhất rồi giấu khác biệt.

## Các bẫy đã tìm thấy

| Vấn đề | Bằng chứng nguồn | Quy tắc triển khai |
|---|---|---|
| SHA khác SHSmart | SHA auth login-v2/matrix/verify-sotp trên api.shs.com.vn | Không reuse /api/v1/login, otpType hoặc expiry của SHSmart |
| subNo vs subId | list-sub-no và order/balance | Query balance.subNo nhận internal subId; DTO tách display number và reference |
| remNo không luôn là broker | order-confirm-summary doc dùng login; list-confirm dùng emNo | Builder riêng, không utility thay mọi remNo bằng brokerCode |
| GET/POST loan-info | Một cái tổng nợ, một cái danh sách khoản vay | Method+path là identity contract |
| Lịch sử và hôm nay | trade_pro_agent dùng type:0, không dates; dated doc cần dates | Discriminator mode; null interpretation riêng |
| Price scale | Histories mô tả kVND; list-confirm chuỗi giá VND đã format | Không x1000 toàn bộ order responses |
| Localized numbers | list-confirm có dấu chấm ngăn nghìn | Parse locale theo schema, không parseFloat |
| Tổng lặp ở portfolio | evalAmtSum/bookAmtSum trong từng dòng | Check giống nhau rồi lấy một; không sum |
| Tổng lặp paging | Broker assets/cash/loan reports | Phân biệt total toàn filter với sum của page |
| Loan key | revenue sync xử lý khoản vay theo nhiều trường | Key accountNo+acctNo+subNo+lndDate+lndTp; không acctNo đơn |
| sumInt | Loan list có lãi và phí, totalDueAmount | Không cộng sumInt cùng các phần con thêm lần nữa |
| Account list thiếu ngày mở | list-by-rem-no | Lấy information.openDt nếu cần, không tự gán |
| Account count vs rows | Cash movements | dpsAccCnt/wthDrwAccCnt là account count, không transaction count |
| Null account | Deposit/withdraw source có dòng chưa gán account | Chỉ giữ trong broker report được phép, không account scope |
| Custid/mnId | revenue_sync_agent dùng custid; Swagger dùng mnId | G2 thử payload hiện hành, không gửi cả hai kiểu đoán |
| Order-account summary | Doc cũ null/sum*; report.js dùng totalTransactionValue/revenueFee | Nonempty fixture; không invent sum fields |
| depositoryFee | report.js gán pitTax nhưng tên field khác nghĩa | DTO giữ nghĩa chưa xác minh; không công bố là thuế trước đối chiếu |
| OrdNo | gotchas nói số theo sàn; list-confirm doc phân biệt số công ty | Giữ nguồn/route; key gồm account/date/market khi được chứng minh; không global sort hoặc join mù |
| Status 4/5 | Nguồn chưa đủ mẫu; status 1 có ghi inferred | Return raw+label null nếu chưa verified; không suy khớp/hủy |
| list-confirm status N | Enum khác numeric histories | Không map chung |
| price input balance | Probe live 10/10/2026 với price chuỗi VND | buying-power đã bật theo quyết định release; giữ số liệu trả về/unit unverified, không đặt lệnh |
| order/sum-transaction kỳ | valueFilterInfo chưa có schema kỳ chắc chắn | period=unknown; không tự nhận from/to chưa upstream support |
| authorized/top summary | Chỉ null hoặc [] lịch sử | Không suy tài khoản không có dữ liệu; chờ nonempty schema |
| research Amount | Tổng số khuyến nghị, không tiền | Unit count sau xác minh |
| Tick ti | Format thời gian nguồn chưa chắc | sourceTimeRaw; chưa đủ ngày/zone => timestamp null |
| TradingView | Flat arrays, t seconds, s/no_data/nextTime | Parser UDF riêng, kiểm equal-length/chronology |
| Local dashboard | KPI/SQLCipher/snapshot có các phép tính nội bộ | Không quảng cáo mọi chart là một API SHA tương ứng |

## Không port những suy luận sau thành sự thật upstream

Dashboard nguồn có “active mở mới = NAV > 0 tại lúc đồng bộ”, classifier equity/bond/unknown, cách tính phí chuẩn/phí thực thu và snapshot tháng. Đây là derivation của ứng dụng, không mặc nhiên là contract của SHA API. MVP trả field nguồn được hiểu rõ. Nếu thêm metric dẫn xuất: công thức, kỳ, denominator, attribution, unit, missing policy, rounding và test riêng phải được ghi trong dictionary.

Không tự gọi mã chứng khoán chưa phân loại là equity; không tính return có điều chỉnh quyền/cổ tức khi chưa có chuỗi adjusted đáng tin. Danh mục mã không chứng minh full-universe. Không gộp giá SHSmart/Fialda vào tài sản SHA để lấp thiếu.

## Schema và dữ liệu rỗng

Input strict; output chỉ mapping field allowlist, có thể chấp nhận unknown upstream fields rồi bỏ để tránh phá app khi nguồn thêm field. Nhưng missing field bắt buộc, sai kiểu, mảng/object đổi nhau hoặc query-period mismatch phải là schema error. Chỉ định required vs nullable bằng fixture ở G2; catalog hiện chưa tuyên bố mọi field luôn có.

`0` là số đã có bằng chứng, `null` là giá trị nguồn chưa biết/không áp dụng, missing là field không được trả, empty array là danh sách rỗng theo contract đã xác minh. Không collapse bốn trường hợp thành một. Null-only evidence giữ operation disabled.

## Quy tắc release 10/10/2026 (Đại ca chọn)

- Số liệu chưa xác minh đơn vị vẫn bật: trả giá trị nguồn dạng chuỗi decimal chính xác, meta.units status unverified, cảnh báo UNIT_UNVERIFIED; không quy đổi kVND/VND/%.
- Số JSON có phần lẻ nhận dạng biểu diễn ngắn nhất (0.07 → "0.07"); số nguyên vượt 2^53 bị từ chối; chuỗi số vi-VN parse theo fieldMap.
- data null từ nguồn trả data null, status partial, cảnh báo SOURCE_NULL; không thành 0 hay danh sách rỗng.
- PII khách hàng (tên, số tài khoản đầy đủ, CMND/CCCD và ngày/nơi cấp, ngày sinh, giới tính, điện thoại, email, địa chỉ, mã số thuế, SIDC/PCOD, số hợp đồng, htsId, tài khoản chuyển, nội dung giao dịch) chỉ có với profile.pii. Tên nhân viên môi giới không phải PII khách hàng.
- Mảng lồng chưa rõ shape (children của brokerAssets, list trong brokerAssets.portfolio, danh sách người nhận khuyến nghị) bị bỏ, ghi trong rawResponse của catalog.
- fieldMap sinh bằng scripts/gen-fieldmaps.mjs từ config/live-shapes-20261010.json (chỉ tên field/kiểu); operation có mẫu live rỗng dùng field theo doc SHA_PC @7261a8d, evidenceStatus doc-only.

## Quan sát live 10/10/2026

- Khoảng ngày nghiệp vụ không được vắt qua 2026-05-22..24 (SHA đổi core, không có dữ liệu — Đại ca dặn): lỗi PERIOD_SPANS_DATA_GAP; tách ≤21/05 và ≥25/05 rồi ghép. Không áp cho dữ liệu thị trường.
- loan-info/history: bộ lọc fromLndDate/toLndDate không lọc theo lndDate như doc; dòng ngoài kỳ được giữ và gắn PERIOD_FILTER_UNVERIFIED.
- Đơn vị khác nhau giữa API: order/histories giá và orderValue nghìn VND; asset/investment-portfolio và market giá VND; số tiền tài sản/khoản vay/nộp rút là đơn vị nguồn (khả năng VND). Không quy đổi chéo.
- Số điện thoại, giấy tờ, SIDC/PCOD, mã phòng là chuỗi chữ số, giữ nguyên (số 0 đầu).
- order/list-confirm: pageSize 5 bị từ chối, 30 hợp lệ; giá/khối lượng chuỗi vi-VN ("1.000"), đơn vị đồng — khác order/histories (nghìn đồng).
- order/balance chỉ tính sức mua cho mã/giá (price chuỗi VND); không tạo lệnh. order/sum-transaction là tổng trong ngày, ngoài giờ trả null toàn bộ → SOURCE_NULL.
- KMS forward/cms (Strapi): {data, meta.pagination}; Content là văn bản không tin cậy, cắt 4000 ký tự (contentTruncated, CONTENT_TRUNCATED); mã phòng ban kiểm với danh sách live trước khi gọi.

## Từ điển mã trạng thái và phân loại (11/10/2026)

[sha-code-dictionary.json](../../config/sha-code-dictionary.json) tách khỏi fieldMap sinh tự động: 29 trường đã rà, 30 nhãn cho 12 trường; 17 trường còn lại chưa tìm được bảng mã. Tra theo operation + DTO field + mã chính xác, cả số và chữ. `get_profile_data_dictionary` trả `codeDictionary`; mỗi kết quả nghiệp vụ liên quan kèm cùng bảng ở `meta.codeDictionary` (cả text JSON và structuredContent). Đây là bảng tham khảo tĩnh, không ngụ ý những mã trong bảng xuất hiện trong kết quả. Không thay mã gốc, không suy null/missing thành trạng thái nào, không chuẩn hóa số 0 đầu hoặc chữ hoa/thường.

| Trường theo operation | Mã và diễn giải | Bằng chứng |
|---|---|---|
| orders.history.tradeStatus | 0 Chờ khớp; 2 Đã khớp; 3 Đã hủy; 6 Đã sửa | source-documented |
| orders.history.tradeStatus | 1 Khớp một phần | source-inferred |
| orders.history.tradeStatus | 4 Từ chối; 5 Chờ duyệt | source-ui-unverified; AI chat SHA PC có nhãn nhưng API doc nói chưa gặp mẫu |
| orders.history.sellBuyType | NB Mua; NS Bán | source-documented |
| orders.unconfirmed.tradeStatus | N Chưa xác nhận | source-documented; Y chưa có bằng chứng, không map |
| cash.movements.status / transTp | status 1 Thành công; transTp 1 Nộp, 2 Rút | source-documented |
| profile.information.acntStat | A Đang hoạt động; C Đã đóng; S Tạm ngưng; P Chờ kích hoạt | source-ui-unverified |
| profile.information.ekycYn / openPth | Y Có, N Không; E eKYC, C Tại quầy, O Online | source-ui-unverified |
| profile.detail.grpTp | I Cá nhân; C/O Tổ chức | source-ui-unverified |
| credit.collateral.violationType / treatmentType | R Vi phạm tỷ lệ, A Nợ quá hạn; E Giải chấp | R/A source-inferred; E source-documented; S best-guess bị loại |
| research.list.status | OPEN Đã mở; CLOSED Đã đóng | source-inferred từ tag và nhãn màn hình; ALL là filter |

`source-documented` chỉ là tài liệu nguồn ghi nhận, không phải kiểm live mới của Profile MCP. Hai mức `source-ui-unverified` và `source-inferred` phải được trình bày kèm hạn chế. Mọi mã ngoài bảng hoặc bảng values rỗng đều chưa biết nghĩa. `loanStatus` có 0/1/2 nhưng chưa map; không dùng ACTIVE/OVERDUE/CLOSED do dashboard tự tính. accountStatus/accStatus/subAccountStatus, smsYn/acptYn và các mã market vẫn chưa map; không mượn bảng của API khác. Profile có thể trả chuỗi `mã - nhãn`: giữ nguyên nhãn nguồn, không cắt/đổi dữ liệu. Hash/dòng nguồn tại [SOURCE-MAP](../SOURCE-MAP.md).

## Coverage và freshness (runtime)

Mỗi kết quả ghi requested period, observed source period nếu có, scope và pagination/truncation. fetchedAt là lúc backend nhận dữ liệu; sourceTimestamp là timestamp dữ liệu có bằng chứng. Nguồn không có ngày kỳ rõ thì không nói “hôm nay” chỉ vì vừa fetch.

Khi có stale/partial/suspicious units, warning machine-readable: `SOURCE_TIMESTAMP_UNAVAILABLE`, `UNIT_UNVERIFIED`, `PARTIAL_PAGE`, `TOTALS_SCOPE_UNKNOWN`, `NON_ATOMIC_SNAPSHOT`, `UNKNOWN_ENUM`, `INSTRUMENT_UNCLASSIFIED`. Có warning không miễn kiểm quyền hoặc schema nền tảng.

Discovery Swagger không tự bật. `docs/api-new-endpoints.md` được nguồn link nhưng không tồn tại trong checkout lúc rà soát; những ghi chú lịch sử “25 APIs/12 successful” không được biến thành live test của dự án này.
