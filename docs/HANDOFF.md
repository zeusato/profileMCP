# Checkpoint Profile MCP — 11/10/2026

Luôn xưng em, gọi người dùng là Đại ca. Không cần lịch sử chat để tiếp tục từ tài liệu này. Diễn biến chi tiết từng bước (DCR, Origin/CSP, contract đăng nhập SHA, probe live, các vòng sửa) nằm trong [VALIDATION](VALIDATION.md); tài liệu này chỉ giữ trạng thái hiện tại và việc còn lại.

## Trạng thái hiện tại

- **Bản sửa login mobile, commit 77037e5:** Đại ca báo Claude app Android lỗi REAUTH_REQUIRED ngay sau ID/password, trước OTP; GPT mobile chưa thử. Tái hiện synthetic: hai interaction dùng chung cookie ShaFlow làm lần thứ hai ghi đè lần đầu. Đã tách cookie theo HMAC(uid), thêm reason/requestId an toàn và sửa thông báo OTP. Đại ca đã cho phép push để Git tự deploy ngày 11/10; cần kiểm tra deployment READY và Đại ca thử lại trên điện thoại trước nghiệm thu. Chưa đủ log để kết luận đây là nguyên nhân chính xác trên điện thoại. Không cần migration hoặc đổi env, không thay đổi contract SHA.

- **Production chạy và đã nghiệm thu với Claude:** https://profile-mcp.vercel.app, MCP URL **https://profile-mcp.vercel.app/api/mcp**, issuer https://profile-mcp.vercel.app. Deployment mới nhất dpl_EzduSGpCgutYVxdMe32Wzhppa9wr (21:36 10/10/2026), đã kiểm metadata READY/production. Checkpoint code trong Git là 77c6bf0; metadata kiểm lần này không trả commit SHA của artifact.
- **Đăng nhập SHA thật** (ID/mật khẩu → matrix OTP → identity → cây tài khoản) chạy từ Vercel syd1; phiên SHA ~8 giờ, refresh SHA không có (refresh_token null) nên hết hạn thì kết nối lại.
- **39/42 operation bật**, 18 tool nghiệp vụ + 2 metadata. Cả 39 đã gọi live qua Claude connector ngày 10/10/2026 với tài khoản môi giới của Đại ca (vai trò môi giới quản lý nhóm). Tắt 3: profile.authorized (null ×8), orderSummary.top ([]), assets.loanDetail (GET 405; dùng loans.current).
- **PII** khách hàng (tên, số TK đầy đủ, giấy tờ, ngày sinh, liên hệ, địa chỉ…) chỉ trả khi connection có scope profile.pii (ô chọn trên trang consent, mặc định không tick). Tên nhân viên môi giới không là PII khách hàng.
- **Nhu cầu Đại ca chốt 10/10:** cần tên khách và số tài khoản đầy đủ, không dùng kết nối che thông tin. Kết nối GPT thử đầu đã bỏ profile.pii ở client nên consent SHA không hiện checkbox. Đã tạo "SHA MCP đầy đủ" xin profile.pii; Đại ca tự login/OTP/tick consent. GPT accounts.tree trả 8/8 dòng có accountNumber/customerName và nối brokerName riêng bằng brokerRef. Không lưu giá trị khách hàng vào repo. Không nhầm brokerName (môi giới) với customerName (khách hàng).
- **Số liệu**: giá trị nguồn dạng chuỗi decimal chính xác, meta.units status unverified; đơn vị quan sát ghi trong fieldMap (lịch sử lệnh nghìn VND, list-confirm/market/portfolio VND). Khoảng ngày không được vắt qua 22–24/05/2026 (đổi core) → PERIOD_SPANS_DATA_GAP.
- **Tests**: 63 synthetic pass ngày 11/10 (60 ca cũ và 3 regression AUTH-FLOW-01..03: cookie nhiều interaction, lỗi/replay/diagnostics và chuyển cookie cũ). Typecheck/build/ESM smoke passed. Kết quả document validator tại [document-validation.json](../config/document-validation.json); coverage thực tại [TEST-MAP](api/TEST-MAP.md).
- **GPT đã kiểm ngày 10/10/2026:** tạo plugin → DCR → người dùng login/OTP/consent → callback → gọi 2 tool metadata trong Work (39 bật/3 tắt; identity.current 9 trường), sau đó accounts.tree có PII trên kết nối đầy đủ (8/8 dòng). Phải bỏ OIDC enabled trong Advanced OAuth settings để không yêu cầu openid; vẫn giữ OAuth. Chưa kiểm toàn bộ nghiệp vụ/PII ở operation khác/vòng đời phiên. Xem [USER-GUIDE](USER-GUIDE.md) và [VALIDATION](VALIDATION.md).

## Cloud và tài khoản

- Vercel project profile-mcp, ID prj_gCrysy0jokg400TLZHJvfnVwi8nB, scope manhquyet88-gmailcoms-projects, Hobby, Node 24.x, region syd1. Bản trước để rollback: dpl_99wAQ6f6L1r9ZYhSfQKYRdSDN3v1 (chỉ metadata), các bản trung gian ghi trong VALIDATION.
- Supabase project rcdmgdnxndyjnosxikbu (Digital16), Sydney. Migration 20261009_001 và 20261009_002 đã áp dụng — **không chạy lại**. 12 bảng ENABLE+FORCE RLS; runtime login profile_mcp_app chỉ EXECUTE private RPC, TLS xác minh CA. Release 2 và 3 **không** cần thay đổi DB.
- Allowlist: một thành viên (Đại ca). Digest subject theo ID chữ thường; Store.member vẫn đọc bản ghi cũ đúng kiểu chữ.
- Callback allowlist: https://claude.ai/api/mcp/auth_callback và https://chatgpt.com/connector_platform_oauth_redirect. Chưa hỗ trợ Claude Code loopback/CIMD (Claude Code dùng connector claude.ai).

## Cách làm việc đã chốt

- Deploy (Đại ca chốt 11/10): Git đã kết nối Vercel; push lên main để tự deploy, sau đó kiểm tra deployment/production. Không chạy thêm `vc deploy --prod` khi Git đang triển khai. Chỉ dẫn cũ để Đại ca tự chạy CLI đã được thay thế.
- Kết nối lại connector khi schema/mô tả tool đổi. Claude Code desktop sau khi bật lại connector có lúc chỉ giữ tool mới; claude.ai web luôn thấy đủ.
- Bằng chứng live mới: `scripts/trace-sha-login.ts --live --probe [--extra]` (Đại ca tự login/OTP trên trang 127.0.0.1; chỉ in cấu trúc) → `config/live-shapes-20261010.json` → `node scripts/gen-fieldmaps.mjs` → tests → deploy. Nguồn tham khảo chỉ đọc: D:\Dev\SHA_PC\SHA_PC_code @7261a8d (xem [SOURCE-MAP](SOURCE-MAP.md)).
- Log production đã khử nhạy cảm: `node scripts/read-safe-logs.mjs` (2 giờ gần nhất, status theo route, event oauth.registration_rejected / oauth.interaction_failed; không body/token). Script báo rõ khi không có log trả về; không xem đó là bằng chứng không có lỗi.

## Secrets và máy khác

- .runtime/env.production.json, .runtime/*.sql là local nhạy cảm (chỉ có trên máy gốc D:\Quyetnm\Dev\Profile MCP), bị ignore Git/Vercel. Clone D:\Dev\profileMCP không có .runtime: không thêm được thành viên allowlist hay chạy configure-deployment từ máy này.
- **Không chạy cloud-bootstrap.mjs** để khôi phục máy mới (sinh keys/team mới, phá sessions/allowlist). configure-deployment.mjs ghi đè env production, chỉ chạy với bộ keys hiện hành đã xác minh.
- Vercel link có thể sinh .env.local (OIDC token) và tự chèn `.env*` vào .gitignore làm mất ngoại lệ `!.env.example` — hoàn nguyên .gitignore sau khi link.
- Supabase CLI phải login đúng account có Digital16 trước mọi thao tác admin; lần kiểm gần nhất CLI ở account khác (403). Lệnh trong [DEPLOYMENT](DEPLOYMENT.md).

## Việc còn lại

1. **GPT**: đã qua DCR/login/OTP/consent/callback, 2 metadata tool và accounts.tree có PII; còn các nghiệp vụ/PII khác, expiry/reconnect/disconnect. USER-GUIDE đã cập nhật theo menu Plugins thực tế; bản PDF ở output/pdf. Metadata thư viện vẫn quảng bá openid trong khi ứng dụng từ chối; hiện cấu hình client tắt OIDC, chưa sửa/deploy runtime.
2. **Thêm thành viên allowlist**: chạy scripts/add-member.ts trên máy có .runtime (hoặc bổ sung quy trình admin không cần file local); thử vai trò môi giới thường và người ngoài allowlist.
3. **Đơn vị**: đối chiếu số liệu với màn hình SHA để chuyển các unit từ "observed" sang verified (đặc biệt orders.history kVND, tỷ lệ/percent, rtt).
4. **3 operation tắt**: bật khi có mẫu không rỗng (khách có ủy quyền; ngày có order/summary), probe lại bằng --extra.
5. **Cleanup scheduler** cho profile_mcp.cleanup_expired() (pg_cron) khi CLI Supabase đúng account; app vẫn kiểm TTL mỗi lần đọc.
6. G3 còn mở: CSRF/refresh replay/account switch (CSP script hash cho auto-submit), nhiều user đồng thời, load mock 20 users, rollback/revoke drill, dev dependency audit (34 findings cây tool Vercel).
7. Client smoke DCR cũ chưa dọn khỏi store; callback claude.com (Anthropic báo có thể đổi) chưa thêm.

Đọc AGENTS, README, IMPLEMENTATION-PLAN, ARCHITECTURE, AUTH-AND-SESSIONS, TRANSPORT, DATA-QUALITY và kiểm Git trước sửa. Nguồn SHA PC/MCP cũ chỉ đọc; không chạy script/copy credentials, logs hay account data.
