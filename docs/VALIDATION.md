# Validation thực tế

Ngày: 09/10/2026. Đây là sổ kết quả thực; test IDs trong TEST-PLAN/TEST-MAP vẫn là planned nếu không ghi rõ ở đây.

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

## Chưa thực hiện / chưa đạt

Live SHA login/OTP/read probes và đơn vị dữ liệu, G1/G2/G4 đầy đủ, refresh SHA (disabled), account switch browser CSP, complete cross-role/cross-user application matrix, 20-user load, cleanup scheduler, rollback/revoke drill và toàn bộ dev-audit remediation. 0 business operations enabled. Local có thay đổi nhỏ sau production chưa redeploy; xem [HANDOFF](HANDOFF.md).

## Giới hạn của kiểm tra tài liệu

Validator kiểm file links nội bộ, JSON parse, uniqueness, count, disabled state, method/host allowlist, traceability/test IDs, input schema structure, schema SQL RLS coverage và dependency-free source metadata. Không xác nhận API còn hoạt động, mapping đơn vị đúng live, dependency compatibility, SQL function semantics chưa viết hoặc quyền runtime chưa cấp.

Kiểm source hashes chỉ xác nhận provenance/nguồn không đổi trong lúc làm; không chứng minh nguồn chính xác về nghiệp vụ. SQL readback xác nhận cấu hình nền đã áp dụng, không thay thế DB-01..06 của application.
