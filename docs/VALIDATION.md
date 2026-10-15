# Validation thực tế

Nhật ký: 09–10/10/2026. Đây là sổ kết quả thực; test IDs trong TEST-PLAN/TEST-MAP vẫn là planned nếu không ghi rõ ở đây. Các checkpoint có ngày giữ nguyên kết quả lịch sử; trạng thái hiện tại xem HANDOFF và mục kiểm lại cuối nhật ký.

## Đã thực hiện

- Kiểm Git SHA PC: working tree sạch, commit 8363a1a1bec8b0d11251ff6f6830d6ea4f747306. Chỉ đọc source/docs, không chạy script repo nguồn.
- Trích metadata không nhạy cảm và biên soạn 40 read candidates, 3 auth control-plane routes, 4 trading writes bị cấm; inventory Swagger 69 path/70 method-path.
- DB-BASE-01: áp dụng SCHEMA.sql thành công trên project rcdmgdnxndyjnosxikbu; readback version 20261009_001 và 11 bảng.
- DB-BASE-02: readback 11/11 ENABLE+FORCE RLS, 0 policy; anon/authenticated/service_role không có schema USAGE và SELECT trên bảng.
- DB-BASE-03 phần cấu hình: Data API tắt và vẫn hiển thị disabled sau tải lại dashboard. Không thêm schema vào API exposure. Chưa có runtime API request để test vì không tạo/copy key.
- Document validator: kết quả máy lưu ở [document-validation.json](../config/document-validation.json), command `node scripts/check-docs.mjs`. Kết quả chỉ có giá trị sau khi file report được sinh trong lần chạy thực.

## Runtime và cloud đã chạy trong checkpoint 09/10/2026

- npm run typecheck; npm test; npm run build; npm run smoke:esm: kết quả actual checkpoint trong HANDOFF. 13 tests synthetic passed; không gọi SHA/live cloud trong test suite.
- Lần kiểm cuối trước push: typecheck, 13/13 tests, build, native ESM smoke và document validator 749 assertions đều passed. Lần chạy lại npm audit --omit=dev bị DNS ENOTFOUND registry.npmjs.org, **không có kết quả audit mới**; lần trước trong phiên production audit trả 0 findings. Không coi lỗi mạng là audit passed.
- tests/contracts.test.ts: 6 cases request binding A/B, phân biệt GET/POST loan, orders today/history/username-vs-broker, strict input/dates, decimal/null/PII, repeated totals/paging và UDF candles. Chỉ assertions đại diện, chưa đủ 200 operation IDs.
- tests/security.test.ts: 6 cases atomic consume 20 callers qua 2 Store objects/PGlite, consumed code không sống lại sau upsert, expiry/revoke fence, crypto AAD/random nonce/rotation/tamper, 40 disabled + writes chặn zero network, cross-user refs/subaccount/nested account drift, envelope/content type/body size, EXECUTE-only và quota concurrent budget. Không ghi mọi SEC/DB ID đã đạt toàn bộ.
- tests/oauth.test.ts: 1 case HTTP round-robin qua 2 Express/OIDC instances dùng store chung; fake SHA browser login/OTP/consent, PKCE sai, code double-use 1 success, refresh rotation, SDK initialize/list/call, deny DCR callback lạ, encrypted artifact không chứa password/OTP canary, disconnect chặn access/refresh. Chưa kiểm đủ CSRF/refresh replay/role matrix/20-user load dù tên test nhóm nhiều ID.
- Apply migration 20261009_002 thành công qua CLI lúc account đúng; 12/12 ENABLE+FORCE RLS, runtime table read false, runtime RPC true. Tạo dedicated login role; runtime kiểm lại TLS verified trả profile_mcp_app và schema version 002. Một active membership; không lưu ID/account vào evidence.
- Vercel deployment dpl_99wAQ6f6L1r9ZYhSfQKYRdSDN3v1 READY, canonical https://profile-mcp.vercel.app. Public health/ready/protected resource/AS metadata đều 200; unauthenticated MCP 401 quan sát từ client logs. Node 24 artifact đã chạy với env production.
- DCR public smoke callback Claude HTTP 201 với none/client_secret_post/client_secret_basic; chỉ metadata basic không có scope. Không in secret/id.
- Claude thử thật: discovery 200, MCP 401, POST /reg 400. **CLIENT-CLAUDE-01 chưa passed**, không tới form SHA. GPT chưa test.
- Supabase CLI lần cuối projects list không có project Digital16, admin query 403. Runtime vẫn healthy; cần login CLI đúng account trước admin/cleanup. Không sửa lại schema để xử lý lỗi CLI.

## 10/10/2026 — DCR Claude

- Clone D:\Dev\profileMCP, npm ci từ lockfile. Baseline trước sửa: typecheck và 13/13 tests passed.
- OAUTH-07 / CLIENT-DCR-01 (tests/oauth.test.ts): MCP SDK 1.32.1 auth() tự discovery, DCR với callback Claude và scope từ PRM scopes_supported. Trước sửa: fail InvalidClientMetadataError "scope must only contain Authorization Server supported scope values". Sau sửa: DCR 201, authorization scope đủ 8 read scopes, một lần consent, code exchange, token scope 8 scopes, SDK listTools 2. Cùng test: DCR scope lạ 400 và log diagnostic chỉ có code/reason/field names; client DCR xin thêm openid bị invalid_scope; pre-registered client xin openid nhận invalid_scope trước login SHA (verify count 0).
- Mutation check thủ công: bỏ grant.addOIDCScope thì OAUTH-07 fail tại trang login SHA (consent loop); đã khôi phục.
- Live production (artifact cũ dpl_99wAQ6f6L1r9ZYhSfQKYRdSDN3v1): một DCR kiểu SDK/Claude có resource scopes trả HTTP 400 invalid_client_metadata cùng thông điệp, AS scopes_supported ["openid"], không cấp client. Không gọi SHA.
- Sau sửa: typecheck, 14/14 tests, build, native ESM smoke, document validator passed. npm audit --omit=dev 0 vulnerabilities; npm audit đầy đủ 34 findings dev tree.
- Đại ca tự deploy production dpl_oazx1484NUdnHyg4PTC4seDnG3WT (Ready, alias canonical). Sau deploy: health/ready/PRM/AS metadata 200; MCP không token 401 + resource_metadata; AS scopes_supported 8 read scopes + openid; probe-registration 4/4 HTTP 201, gồm DCR none + 8 resource scopes. Không gọi SHA.
- **CLIENT-CLAUDE-01 vẫn chưa passed** cho tới khi Claude Connect thật đi qua DCR, login SHA/OTP, consent và tools/list.
- Claude Connect trên dpl_oazx1484NUdnHyg4PTC4seDnG3WT: qua DCR, mở form SHA; submit login trả {"error":"INVALID_ORIGIN"} (Đại ca chụp màn hình). Không gọi SHA.
- Tái hiện bằng Chromium của app trên server synthetic local (PGlite, fake SHA, ID/password/OTP giả): POST login 403 INVALID_ORIGIN do Referrer-Policy no-referrer → Origin null. Sau đổi same-origin: login/OTP qua, consent bị CSP form-action 'self' chặn redirect (console). Sau thêm origin redirect_uri vào form-action riêng trang consent: đi tới callback client. Typecheck và 14/14 tests pass với assertions mới trong approve(). Đại ca deploy dpl_BE7kQpGHx1HJqGswsJnQuuLsJ9WS: health/ready/PRM/AS 200, MCP không token 401, AS 9 scopes, Referrer-Policy same-origin trên production.

## 10/10/2026 — G1 trace local (AUTH-01 một phần)

- Claude Connect trên dpl_BE7kQpGHx1HJqGswsJnQuuLsJ9WS: POST login 401 UPSTREAM_AUTH_FAILED (read-safe-logs). Không có log bước SHA trên artifact đó.
- scripts/trace-sha-login.ts --live trên máy local; Đại ca tự nhập ID/password/OTP của chính mình; output chỉ status/kiểu/tên field/số lượng, không giá trị. Kết quả từng lần: (1) login-v2 200, schema fail trustDevice null; (2) generate-matrix HTTP 400 code 405 "Session hết hạn"; (3) sau thêm Session-Key + Bearer null: login-v2/generate-matrix/verify-sotp/get-user-login 200, parseIdentity fail do khác kiểu chữ preferredUsername; (4) sau sửa: login-v2 → generate-matrix → verify-sotp → get-user-login → account-no-and-rem đều 200, session_ready TTL ~479 phút, 1 identity row, 8 accounts, 6 brokers. refresh_token null.
- DevTools web gốc (Đại ca chụp): Authorization: Bearer null cho auth công khai; Session-Key header ở generate-matrix và verify-sotp; Correlation-Id khác nhau mỗi request; login-v2 không Set-Cookie.
- Một tài khoản, một vai trò, từ IP local. **Chưa xác minh từ Vercel**; AUTH-02..09, role khác, logout/đa phiên chưa thử. typecheck, 15/15 tests (thêm SEC-06 diagnostics, trustDevice null + Session-Key, identity case), document validator passed. Chưa deploy.

## 10/10/2026 — production connect và accounts.tree

- dpl_4rRDrodsumhqpGc1azvCuBYBTqsR: Đại ca Connect trên Claude thành công (login/OTP qua Vercel). Em gọi qua connector: list_profile_capabilities trả 40 candidates, liveOperations []; get_profile_data_dictionary trả đủ 40/40 entry, không lỗi. read-safe-logs: /api/mcp có token 200/202; vài POST 400 chưa phân tích.
- Từ điển còn sai lệch cần sửa theo từng operation: evidenceStatus cũ ở mọi entry; identity.current thiếu homeOrder/custodyCd; tiền tố DTO lẫn items[]/data[]/content[]/list[]; nhiều unit unverified.
- accounts.tree + profile.pii (chưa deploy): tests/accounts-tree.test.ts REQ/RAW/DTO/SCOPE/PAGE passed; oauth.test.ts gọi list_managed_accounts qua SDK có/không PII; SEC-02 kiểm tool schema không có oneOf cấp cao nhất. 20/20 tests, typecheck, document validator passed. Mutation bỏ chặn PII làm DTO-accounts.tree fail.

## 10/10/2026 — accounts.tree live qua Claude connector

- Đại ca commit 5ab3f22 (v2), deploy, kết nối lại connector và tick profile.pii. list_profile_capabilities: liveOperations ["accounts.tree"].
- Em gọi list_managed_accounts {operation: accounts.tree} qua connector lúc 13:27:51Z: status ok, 8/8 tài khoản, 6 broker (1 gốc của người dùng + 5 con), coverage complete, nonpaged-full-tree, missing [], có accountNumber/customerName/brokerName vì có profile.pii. Không ghi giá trị vào repo.
- Phiên Claude Code chỉ thấy 1 tool của SHA MCP (tool_count 1) sau khi bật lại connector; 2 tool metadata không còn trong danh sách phía client dù code release trả 3 tool. Chưa rõ nguyên nhân phía client/cấu hình connector; cần kiểm.

## 10/10/2026 — probe live hàng loạt và release lần 2

- Probe chỉ-đọc từ máy local sau một lần login/OTP của Đại ca: 36/38 candidate HTTP 200 code 200; assets.loanDetail (GET loan-info) 405; orders.unconfirmed 400 "Invalid parameter". Cấu trúc lưu config/live-shapes-20261010.json; grep số tài khoản/tên/UUID trong file = 0.
- Release lần 2 (chưa deploy): 34 operation; typecheck; 53/53 tests (gồm 33 bộ REQ/RAW/DTO/SCOPE/PAGE sinh từ fieldMap); document validator 753 assertions.
- Chưa: gọi live từng operation qua connector sau deploy; đối chiếu đơn vị với màn hình SHA; profile.authorized/orderSummary.top/transactions chưa có mẫu không rỗng.

## 10/10/2026 — gọi live release lần 2 qua connector

- 27/34 operation gọi được qua Claude Code connector sau deploy; chi tiết và 7 lỗi sửa trong HANDOFF. Không ghi giá trị khách hàng vào repo.
- Sau sửa: typecheck, 55/55 tests (thêm REQ-common data gap 22–24/05/2026 và regressions subNo/credit body/requestedPeriod/list coverage/PERIOD_FILTER_UNVERIFIED), document validator 753 assertions, build, ESM smoke. Chưa deploy bản sửa.

## 10/10/2026 — phủ toàn bộ API đọc

- Connector sau deploy: 33/34 operation gọi được; subNo, credit body, số 0 đầu đúng; portfolio.account lệch doc (6 key doc không có) → map theo field live.
- Probe --extra (structure-only, appended vào live-shapes): list-confirm 400 fieldName pageSize (5) / 200 với 30; balance 200; sum-transaction 200 toàn null; summary []; authorized null ×8; KMS departments 6, documents 3 và 5 bài.
- Release: 39/42 route bật; typecheck, 60/60 tests (table REQ/RAW/DTO/SCOPE/PAGE cho 38 operation projection + regressions KMS/list-confirm/sum-transaction/path traversal), document validator, build, ESM smoke. Chưa deploy.

## 10/10/2026 — nghiệm thu live release 3 qua connector

- 39/39 operation bật đã gọi live ít nhất một lần qua Claude Code connector trong ngày (các vòng 14:00–14:35Z), trừ market.candles/ticks gọi từ vòng trước cùng ngày. Không ghi giá trị khách hàng vào repo.
- Sửa cuối: KMS HTML→text, mô tả list-confirm; 60/60 tests, document validator, build, ESM smoke. Đã deploy; knowledge.documents live trả văn bản thuần (contentFormat text-from-html).

## Chưa thực hiện / chưa đạt

ChatGPT acceptance cho nghiệp vụ/PII/vòng đời phiên (kết nối và metadata đã đạt, xem checkpoint bên dưới), expiry/reconnect/disconnect live đầy đủ, đối chiếu đơn vị với màn hình SHA, G1/G2/G3/G4 toàn bộ tiêu chí, refresh SHA (disabled), account switch browser CSP, complete cross-role/cross-user application matrix, 20-user load, cleanup scheduler, rollback/revoke drill và toàn bộ dev-audit remediation. Hiện 39/42 business operations bật; 3 operation tắt giữ PLANNED. market.candles có test RAW parser; 4 ID còn lại chưa có suite riêng tương ứng. Các test bảng là coverage synthetic, không chứng minh toàn bộ edge case của 210 ID thiết kế.

## 10/10/2026 — hoàn tất tài liệu và kiểm lại checkpoint

- Hoàn tất README/USER-GUIDE/HANDOFF, đồng bộ kiến trúc/auth/operation/test map và runtime config với trạng thái 39/42 operation; sửa các dòng hiện trạng cũ, giữ nguyên số 13/14 tests trong checkpoint lịch sử.
- SHA_PC tại D:\Dev\SHA_PC\SHA_PC_code: HEAD 7261a8dbf4ab9ba4cb086b869909b59579e8b417; kiểm Git và SHA256 của 4 file trong SOURCE-MAP đều khớp, không thay đổi nguồn hoặc chạy script nguồn.
- Node 24.21.0 từ dependency đã pin: `npm run typecheck`, `npm run build`, `npm run smoke:esm` passed. Lần đầu `npm test`: 58/60 pass, 2 OAuth tests bị sandbox chặn loopback (connect EACCES 127.0.0.1). Chạy lại toàn bộ với quyền kết nối localhost: **60/60 passed, 0 fail/skip**; fake SHA/PGlite, không gọi SHA/cloud thật.
- `vercel inspect https://profile-mcp.vercel.app --json` (chỉ đọc metadata): deployment dpl_EzduSGpCgutYVxdMe32Wzhppa9wr, READY, target production, tạo lúc 21:36 ngày 10/10/2026. Metadata lấy được không trả commit SHA của artifact; 77c6bf0 là checkpoint code local. Không deploy trong lần hoàn tất tài liệu này.
- `npm run check:docs` passed; report máy tại config/document-validation.json. `sourceHashChecks: not-requested` trong report chỉ nói chưa chạy tùy chọn `--verify-source` cho manifest lịch sử 09/10; 4 file SHA_PC bổ sung được kiểm riêng bằng Get-FileHash như trên.
- Pre-commit: `git diff --cached --check` sạch; `scripts/check-staged-secrets.mjs` passed trên 19 file staged (private path/JWT/private key/token patterns; không có local private material để so sánh). Quét thêm mẫu số tài khoản SHA, email và số điện thoại/giấy tờ không có findings sau khi đối chiếu UUID requestId synthetic trong MCP-CONTRACT; không in giá trị khớp.

## 10/10/2026 — ChatGPT Work: kết nối và metadata

- GPT-CONNECT-01 manual: trên ChatGPT web → Plugins → Add custom MCP server, URL production /api/mcp, OAuth/DCR, 8 scope đọc, bỏ profile.pii, Base scopes trống và bỏ OIDC enabled. Discovery tự điền đúng auth/token/reg/issuer/resource. Đã tạo SHA MCP, Continue to SHA MCP mở trang login có tên ChatGPT; Đại ca tự nhập login/OTP/cấp quyền. Sau callback giao diện báo "Primary is now connected".
- Cấu hình OIDC mặc định cần chú ý: metadata oidc-provider quảng bá openid; scope gate ở src/interactions.ts không chấp nhận scope này. ChatGPT UI mặc định bật OIDC. Đã kiểm luồng thành công khi tắt OIDC ở client; không đổi Authentication khỏi OAuth, không sửa/deploy runtime. Không thử một lần đăng nhập thất bại với OIDC bật; nguy cơ invalid_scope được suy từ metadata + code + hành vi scope trong tài liệu OpenAI.
- GPT-META-01 manual: mở Work, @SHA MCP, chỉ yêu cầu list_profile_capabilities và get_profile_data_dictionary. Hoạt động hiển thị hai lượt SHA MCP (Listing Enabled Profile Capabilities; Retrieving Current Identity Profile Data), phản hồi 39 operation bật, 3 tắt, dictionary identity.current có 9 trường. Không gọi nghiệp vụ khách hàng/tài sản/lệnh trong phép thử này. Không lưu token, mật khẩu, OTP hoặc dữ liệu khách hàng.
- Probe public chỉ đọc: AS metadata và resource metadata HTTP 200; GET /api/mcp không token trả 401 kèm WWW-Authenticate trỏ đúng resource metadata. AS có issuer chính xác, authorization_response_iss_parameter_supported true và PKCE S256.
- Còn chưa thử qua GPT: 39 operation nghiệp vụ, PII, expiry/reconnect/disconnect và các vai trò khác. Không tính 2 ca manual vào 60 synthetic tests. USER-GUIDE và bản PDF được cập nhật theo UI thật; bổ sung nguyên nhân/điều kiện bật 3 operation đang tắt.
- Nguồn OpenAI đối chiếu: https://developers.openai.com/plugins/quickstart ; https://developers.openai.com/plugins/build/auth ; https://developers.openai.com/plugins/deploy/connect-chatgpt . Bằng chứng UI local: output/pdf/chatgpt-sha-verified.png (chỉ phép thử metadata).

## 10/10/2026 — sửa cấu hình GPT thiếu profile.pii

- Đại ca yêu cầu hiện đủ tên khách và số tài khoản. Kiểm live kết nối thử cũ: accounts.tree trả displayNumber che, không có accountNumber/customerName; brokerName thuộc cây môi giới, không phải tên khách. Đọc src/interactions.ts xác nhận checkbox consent chỉ được render khi client đã xin profile.pii; bỏ scope ở ChatGPT làm người dùng không thấy checkbox.
- Tạo kết nối "SHA MCP đầy đủ" với 9 scope (8 đọc + profile.pii), OAuth/DCR, OIDC tắt. Đại ca tự login/OTP và xác nhận đã tick ô PII/cấp quyền. ChatGPT báo connected.
- GPT-PII-01 manual: @SHA MCP đầy đủ, gọi list_managed_accounts operation accounts.tree. Giao diện hoạt động hiển thị Listing Managed Account Tree; bảng trả 8/8 dòng có accountNumber/customerName, brokerName nối riêng qua brokerRef, không thiếu trường. Không lưu số tài khoản hoặc tên khách vào repo/ảnh bằng chứng. Không thay đổi code/runtime/deploy, chỉ cấu hình client và hướng dẫn.
- Kết nối cũ còn thiếu scope không thể tự hiện PII; chọn kết nối đầy đủ khi hỏi. PII ở các operation khác và vòng đời phiên vẫn chưa nghiệm thu qua GPT.
- Đã đổi tên app cũ thành "SHA MCP cũ - che thông tin" để tránh chọn nhầm. Trang /connections xác nhận phiên mới có profile.pii; bằng chứng local output/pdf/chatgpt-full-scope-verified.png không chứa dữ liệu khách hàng.

## 11/10/2026 — lỗi trước OTP trên Claude Android; sửa cookie ở local

- Đại ca báo app Claude trên điện thoại Android trả REAUTH_REQUIRED sau ID/password, chưa tới OTP; GPT mobile chưa thử. Không có bằng chứng thiếu tham số thiết bị/trình duyệt: adapter SHA gửi cùng contract từ backend. Truy vấn log production trong 2 giờ gần nhất không trả bản ghi; không suy ra yêu cầu đã/không tới SHA từ sự vắng mặt này.
- Tái hiện bằng AUTH-FLOW-01 trước sửa: mở hai OAuth interaction chung browser, POST login của luồng đầu nhận 400/REAUTH_REQUIRED với đúng thông báo cũ trong ảnh. Cookie ShaFlow chung bị luồng thứ hai ghi đè. Harness được sửa để giữ cookie theo tên + Path giống routing cookie của provider; bản cũ chỉ giữ theo tên nên không kiểm được nhiều interaction.
- Sau sửa: cookie SHA riêng theo HMAC(uid), vẫn giữ HttpOnly/Secure/SameSite=Lax/Path=/ và TTL 10 phút. Hai luồng qua login, OTP, consent độc lập trên hai instance. Cookie cũ chuyển tiếp có kiểm UID. Không sửa headers/body contract SHA, không thêm device/browser spoofing hay bỏ CSRF/Origin/atomic consume.
- AUTH-FLOW-02 kiểm cookie thiếu/provider cookie thiếu, flow hết hạn/sai UID (kể cả legacy), CSRF sai, concurrent double-submit/replay chỉ gọi SHA begin một lần; flow OTP thắng vẫn dùng được. Diagnostic chỉ có event/requestId/step/error/reason, không có cookie, OAuth UID, CSRF, ID/password/OTP canary. AUTH-FLOW-03 kiểm chuyển cookie trước nâng cấp. Password/OTP được xóa khỏi req.body cả khi lỗi xảy ra trước consume.
- Trang lỗi login không còn nói OTP đã gửi; có mã hỗ trợ để đối chiếu event oauth.interaction_failed. SessionNotFound của provider được phân loại REAUTH_REQUIRED thay vì lỗi store. read-safe-logs có timeout, lọc event mới và báo rõ khi không có log.
- Đã chạy Node 24.21.0: **63/63 synthetic pass, 0 fail/skip**, typecheck, build và native ESM smoke passed. Synthetic dùng fake SHA/PGlite + loopback được cấp quyền; không login hay gửi OTP thật. Không cần migration/env/dependency mới.
- **Chưa deploy hoặc nghiệm thu lại Claude Android.** Lỗi cookie đã được chứng minh và sửa; chưa xác nhận đó là nguyên nhân thực tế của lần lỗi trên điện thoại. AUTH-09 về nhiều phiên SHA thật vẫn còn mở.

## 11/10/2026 — Claude Android xác thực thành công; sửa MCP text output

- Đại ca xác nhận login và cấp quyền thành công sau Git deploy 6eef218 (bao gồm cookie fix 77037e5), Vercel READY và health/ready 200. Trước lần thành công: verify-sotp HTTP401/code014, sau 160 giây gửi lại cùng interaction gặp flow_expired; phiên bị hủy sau lần từ chối nên lần hai chưa gọi SHA. Không kết luận ý nghĩa mã 014 khi chưa có tài liệu mapping.
- Claude báo tool chạy được nhưng chỉ nhận placeholder trong content; capabilities chỉ có số lượng. Code src/mcp.ts xác nhận dữ liệu chỉ nằm trong structuredContent. Đây là lỗi tương thích output, tách biệt với OAuth hoặc contract SHA.
- Thêm MCP-TEXT-01 vào hai SDK integration test hiện có. Trước sửa cả hai fail vì text "Read result available in structuredContent." không phải JSON. Sau sửa text là JSON của cùng DTO đã lọc quyền/PII, kể cả capabilities/dictionary, dữ liệu và lỗi (isError giữ nguyên). Không expose raw SHA/token hoặc nới scope.
- Assertions kiểm client chỉ đọc text: 39 operation bật/3 candidate, dictionary có fields, identity.current có dữ liệu/meta, accounts.tree có/không profile.pii, null giữ nguyên, lỗi có code/requestId, text khớp structuredContent và không chứa bearer canary. Node 24.21.0: **63/63 synthetic pass, 0 fail/skip**; đây là tăng assertions trong suite cũ, không tăng số test.
- Sau push, kiểm Git deployment READY/commit khớp và health/ready. Đại ca cần gọi lại tool trên Claude Android để nghiệm thu dữ liệu thực; phiên hiện có dùng tiếp nếu còn hạn. Không đổi DB, env, dependencies hoặc schema input.
- Tham chiếu: [MCP 2025-11-25 — Structured Content](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#structured-content), đối chiếu 11/10/2026.

## 11/10/2026 — từ điển status số/chữ từ SHA PC

- Đại ca xác nhận Claude đã đọc đủ 8/8 tài khoản sau fix MCP text a96b34c. Không lưu dữ liệu khách hàng vào repo. sourceTimestamp vẫn null vì không có bằng chứng thời điểm chốt nguồn.
- Rà source @7261a8d chỉ đọc: bổ sung 29 trường, 30 nhãn cho 12 trường; 17 trường chưa có bảng mã. Tách source-documented, source-ui-unverified và source-inferred. Đặc biệt history tradeStatus 4/5 chỉ là nhãn của AI chat SHA PC; tài liệu API ghi chưa gặp mẫu. Không nâng thành enum đã nghiệm thu.
- Dictionary metadata tool và meta.codeDictionary trong kết quả nghiệp vụ dùng cùng bảng tĩnh; data/code gốc không đổi, không gọi thêm SHA. Loại bỏ khẳng định Y=đã xác nhận khỏi mô tả orders.unconfirmed vì chưa thấy bằng chứng. Bảng mã nằm riêng fieldMap để không mất khi regenerate.
- Node 24.21.0: **67/67 synthetic pass, 0 fail/skip**; typecheck, build, native ESM smoke passed. DICT-01..04/DICT-SDK kiểm operation-specific labels, mức bằng chứng, unknown/leading-zero/null/missing, coverage/PII, provenance và client chỉ đọc text. Chi tiết TEST-MAP. Không login hoặc gửi OTP thật, không xác nhận ngữ nghĩa mới bằng test synthetic.
- 6 hash SHA256 nguồn được kiểm lại khớp sau khi sửa; Git source HEAD vẫn 7261a8d và 6 file không có thay đổi. Document consistency được kiểm bằng scripts/check-docs.mjs; báo cáo JSON riêng không chạy manifest nguồn cũ, nên sourceHashChecks ở báo cáo vẫn not-requested.
- Push main để Vercel Git integration tự triển khai theo chỉ dẫn Đại ca; không đổi DB/env/dependency. Cần đối chiếu thêm UI SHA thật nếu muốn nâng các mã chưa chắc chắn thành verified.

## 12/10/2026 — phục hồi đăng nhập sau lỗi (local, chưa deploy)

- Đối chiếu mã hỗ trợ từ ảnh Đại ca với `node scripts/read-safe-logs.mjs`: lỗi cuối ở POST login là REAUTH_REQUIRED/flow_expired; các lần trước FORBIDDEN_SCOPE/unclassified. Code cũ xóa ShaFlow sau lỗi nhưng không cung cấp đường lấy form mới. Vì vậy submit form cũ bị chặn trước SHA dù đã đổi sang mật khẩu đúng. Chưa đủ log để biết lỗi FORBIDDEN_SCOPE đầu tiên do allowlist hay binding form; không giả nghĩa mã lỗi nguồn, không lưu raw logs.
- AUTH-FLOW-04 trước sửa fail: password bị SHA giả lập từ chối trả HTTP401 thay vì chuyển về form mới. Sau sửa, chỉ request đã atomic consume được quyền thay lượt lỗi bằng flow login mới và 303 về cùng interaction. Handle/CSRF đổi, credential/challenge/login cũ không giữ, có hướng dẫn lỗi và requestId. ID được trim khoảng trắng; password giữ nguyên.
- AUTH-FLOW-05..08 kiểm OTP sai/timeout/hết hạn/restart, quota shared 5 lần/người/10 phút không bypass bằng interaction hoặc kiểu chữ, phân biệt allowlist/CSRF/params, provider/store lỗi và GET/double submit trong lúc request đầu đang chạy. AUTH-FLOW-01..03 giữ bảo vệ cookie nhiều interaction/legacy/replay. Chi tiết ở TEST-MAP.
- Đã chạy `npm test`: **72/72 pass, 0 fail/skip**; nhóm 8 auth tests chạy lại sau khi bổ sung assertion OTP bị từ chối/không lưu password, tất cả pass. `npm run typecheck`, `npm run build`, `npm run smoke:esm` passed; `npm run check:docs` passed **808 assertions** (chỉ tính nhất quán tài liệu). Không gọi SHA thật, không gửi password/OTP thật. Không thay dependency/lockfile, DB hoặc env.
- **Chưa push/deploy hoặc nghiệm thu lại qua Claude/GPT.** Bản sửa cần deploy khi Đại ca giao và kiểm retry trên client thật; không kết luận bản local đã xử lý xong mọi nguyên nhân của lỗi production.

## 15/10/2026 — KMS giữ nội dung thân bài (đã deploy qua Git)

- Tái hiện lỗi cũ bằng hàm runtime: img-only → Content rỗng; anchor chỉ còn nhãn, mất href. Sửa bằng parse5 8.0.1 đã kiểm registry và pin lockfile; text kèm marker và danh sách body media/link, giữ ảnh bìa riêng. Không dùng raw dữ liệu thật làm fixture.
- Bỏ mốc cắt 4000 ký tự. Nội dung dài được phân phần và phân trang dưới budget 128 KiB; con trỏ chỉ lưu page/offset/digest, ràng buộc phiên/quyền/filter. Khi tải lại mà trang nguồn đã đổi, fail closed, không ghép nhầm bài. Giữ null/missing, URL tương đối, thứ tự ảnh và link.
- Node 24.21.0: chạy toàn bộ `node_modules/node/bin/node.exe --import tsx --test tests/*.test.ts`: **77/77 pass, 0 fail/skip**. Bao gồm KMS-01..05 và KMS-SDK trong OAuth integration; bài chữ Unicode dài và 250 ảnh, thân bài chỉ ảnh, ảnh responsive/lazy, HTML lỗi, URL nguy hiểm, bảng/pre, cursor cross-session/filter/scope, nguồn đổi và cursor không tồn tại. Client SDK chỉ nhận text vẫn có media refs giống structuredContent.
- Typecheck, TypeScript build và native ESM smoke passed. Document consistency passed 811 assertions; báo cáo docs ở config/document-validation.json chỉ xác nhận tính nhất quán tài liệu.
- npm launcher mặc định của máy trỏ tới npm-cli thiếu; dùng Node 24 đã pin + npm-cli tại C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js. Cài dependency với ignore-scripts; lockfile chỉ thêm parse5/entities, giữ nguyên metadata optional packages cũ.
- Đại ca giao push: commit `d67a3d271b45e3d1c48ba4dccb5711d04125db9c` lên main; Vercel Git deployment `dpl_9Nd6aFk9PDQwGgiH1SU31j2r3iNd` READY, URL profile-2ipps368v-manhquyet88-gmailcoms-projects.vercel.app; inspect canonical domain xác nhận alias trỏ đúng deployment. Health/ready và hai OAuth metadata endpoints đều 200; POST MCP không token 401 kèm resource_metadata. Không chạy thêm vc deploy. **Chưa kiểm raw bài Reactive thật hoặc nghiệm thu Claude/GPT live.** Không đổi route, input schema, scope, DB/env. Tool trả tham chiếu ảnh, không OCR/tải ảnh tự động; CSS background/nội dung nhúng chưa đọc và URL không hỗ trợ có warnings. Cần làm mới mô tả tool ở client sau triển khai.

## Giới hạn của kiểm tra tài liệu (phạm vi)

Validator kiểm file links nội bộ, JSON parse, uniqueness, count, disabled state, method/host allowlist, traceability/test IDs, input schema structure, schema SQL RLS coverage và dependency-free source metadata. Không xác nhận API còn hoạt động, mapping đơn vị đúng live, dependency compatibility, SQL function semantics chưa viết hoặc quyền runtime chưa cấp.

Kiểm source hashes chỉ xác nhận provenance/nguồn không đổi trong lúc làm; không chứng minh nguồn chính xác về nghiệp vụ. SQL readback xác nhận cấu hình nền đã áp dụng, không thay thế DB-01..06 của application.
