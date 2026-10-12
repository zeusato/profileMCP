export function escapeHtml(value: unknown) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }
export function page(title: string, body: string) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Profile MCP</title><style>
  :root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#10171b;color:#e7eeef}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px 20px;background:radial-gradient(ellipse at top right,#16362f 0,transparent 55%)}main{width:100%;max-width:560px}header{display:flex;align-items:center;gap:12px;margin-bottom:44px;font-size:14px;letter-spacing:.12em}.mark{background:#b9e5c8;color:#123129;border-radius:10px;padding:9px 12px;font-weight:800}h1{font-size:34px;line-height:1.2;letter-spacing:-.03em;font-weight:600}p,li{color:#aebcbf;line-height:1.7}section{background:#192327;border:1px solid #304144;border-radius:18px;padding:28px;margin-top:24px}label{display:block;color:#dce7e5;font-size:14px;margin:18px 0 8px}input{width:100%;padding:13px;background:#10191c;border:1px solid #45605e;border-radius:8px;color:#fff;font-size:16px}button,a.button{display:block;width:100%;margin-top:24px;padding:14px;border:0;border-radius:8px;background:#b9e5c8;color:#16352b;font-size:15px;font-weight:650;text-align:center;text-decoration:none;cursor:pointer}.secondary{background:transparent;color:#b7c7c9;border:1px solid #405355}a{color:#b9e5c8}code{display:block;overflow-wrap:anywhere;color:#c9e5d8;background:#10191c;padding:14px;border-radius:8px}small{display:block;color:#809699;line-height:1.6;margin-top:24px}.badge{display:inline-block;padding:5px 9px;border:1px solid #4e6860;border-radius:20px;font-size:12px;color:#b9e5c8}ul{padding-left:20px}.challenge{font-size:24px;color:#c7e9d4;letter-spacing:.1em}.check{display:flex;gap:10px;align-items:flex-start;margin-top:20px;color:#dce7e5}.check input{width:auto;margin-top:5px}</style></head><body><main><header><span class="mark">P</span> PROFILE MCP <span class="badge">SHA · chỉ đọc</span></header><h1>${escapeHtml(title)}</h1>${body}<small>Thông tin đăng nhập chỉ được xử lý trên website. Không gửi mật khẩu hoặc OTP vào cuộc trò chuyện.</small></main></body></html>`;
}
export const hidden = (name: string, value: string) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
// Fixed messages only: never display upstream messages or submitted credentials.
export function interactionGuidance(code: string, step: string, reason?: string) {
  if (reason === 'member_not_allowed') return 'ID SHA này chưa được cấp quyền kết nối Profile MCP. Kiểm tra lại ID đăng nhập hoặc liên hệ người quản trị để kiểm tra quyền.';
  if (reason === 'csrf_mismatch' || reason === 'authorization_mismatch') return 'Form này không còn khớp với bước kết nối hiện tại. Quay lại bước kết nối để lấy form mới rồi nhập lại thông tin.';
  if (reason === 'provider_session_missing') return 'Phiên kết nối đã hết hạn hoặc thiếu cookie trình duyệt. Bắt đầu kết nối mới từ ứng dụng và hoàn tất trong cùng cửa sổ trình duyệt.';
  if (reason === 'flow_consumed') return 'Yêu cầu xác thực đang được xử lý hoặc đã được sử dụng. Chờ một lát rồi quay lại bước kết nối. Nếu vẫn gặp lỗi, bắt đầu kết nối mới từ ứng dụng.';
  if (code === 'RATE_LIMITED') return 'Đã thử xác thực quá nhiều lần. Chờ tối đa 10 phút trước khi thử lại. Nếu SHA vẫn giới hạn, hãy chờ thêm; mở kết nối mới không bỏ qua giới hạn.';
  if (code === 'INVALID_INPUT') return 'Thông tin nhập chưa hợp lệ. Kiểm tra lại các trường và nhập lại.';
  if (code === 'FORBIDDEN_SCOPE') return 'Chưa thể cấp quyền cho yêu cầu này. Kiểm tra ID đăng nhập hoặc liên hệ người quản trị kèm mã hỗ trợ.';
  if (code === 'CAPABILITY_UNAVAILABLE' || code === 'UPSTREAM_SHAPE_CHANGED') return 'Chưa thể tiếp tục xác thực với phản hồi hiện tại của SHA. Hãy thử lại sau hoặc liên hệ người quản trị kèm mã hỗ trợ.';
  if (code === 'STORE_UNAVAILABLE') return 'Hệ thống kết nối tạm thời không khả dụng. Hãy thử lại sau hoặc liên hệ người quản trị kèm mã hỗ trợ.';
  if (code === 'REAUTH_REQUIRED' && reason !== 'challenge_expired') return 'Lượt xác thực này đã hết hạn hoặc đã được sử dụng. Quay lại bước kết nối để tiếp tục với form mới.';
  if (step === 'verify') return code === 'UPSTREAM_TIMEOUT'
    ? 'Chưa nhận được kết quả xác thực OTP từ SHA. Hãy đăng nhập lại để tạo mã xác thực mới; mã OTP cũ không được tự gửi lại.'
    : 'Chưa xác thực được OTP hoặc mã đã hết hạn. Hãy đăng nhập lại để tạo mã xác thực mới.';
  if (code === 'UPSTREAM_AUTH_FAILED' || code === 'UPSTREAM_REJECTED') return 'SHA chưa chấp nhận yêu cầu đăng nhập. Kiểm tra ID và mật khẩu rồi thử lại. Nếu thông tin đúng mà vẫn lỗi, hãy thử lại sau.';
  if (code === 'UPSTREAM_TIMEOUT') return 'SHA phản hồi quá chậm. Hãy thử đăng nhập lại; hệ thống không tự gửi lại mật khẩu.';
  return 'Chưa thể hoàn tất kết nối lúc này. Hãy thử lại sau hoặc liên hệ người quản trị kèm mã hỗ trợ.';
}
// Chrome enforces form-action on every redirect after a form submit, so a page whose form ends at a client redirect_uri must list that origin.
export function contentSecurityPolicy(formTargets: string[] = []) {
  const extra = formTargets.map(t => new URL(t).origin).filter(o => /^https?:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(o));
  return `default-src 'none'; style-src 'unsafe-inline'; form-action ${["'self'", ...new Set(extra)].join(' ')}; base-uri 'none'; frame-ancestors 'none'`;
}
