export type ErrorCode = 'INVALID_INPUT' | 'UNAUTHENTICATED' | 'REAUTH_REQUIRED' | 'FORBIDDEN_SCOPE' | 'AMBIGUOUS_SCOPE' | 'CAPABILITY_UNAVAILABLE' | 'UPSTREAM_AUTH_FAILED' | 'UPSTREAM_REJECTED' | 'UPSTREAM_SHAPE_CHANGED' | 'RATE_LIMITED' | 'UPSTREAM_TIMEOUT' | 'STORE_UNAVAILABLE';
export class AppError extends Error {
  constructor(public readonly code: ErrorCode, public readonly status = 400) { super(code); }
}
export function ensure(value: unknown, code: ErrorCode = 'UPSTREAM_SHAPE_CHANGED'): asserts value {
  if (!value) throw new AppError(code, code === 'FORBIDDEN_SCOPE' ? 403 : 400);
}
export function publicError(error: unknown) {
  return error instanceof AppError ? error : new AppError('STORE_UNAVAILABLE', 503);
}
