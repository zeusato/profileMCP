export type ErrorCode = 'INVALID_INPUT' | 'UNAUTHENTICATED' | 'REAUTH_REQUIRED' | 'FORBIDDEN_SCOPE' | 'AMBIGUOUS_SCOPE' | 'CAPABILITY_UNAVAILABLE' | 'UPSTREAM_AUTH_FAILED' | 'UPSTREAM_REJECTED' | 'UPSTREAM_SHAPE_CHANGED' | 'RATE_LIMITED' | 'UPSTREAM_TIMEOUT' | 'STORE_UNAVAILABLE' | 'PERIOD_SPANS_DATA_GAP';
export class AppError extends Error {
  constructor(public readonly code: ErrorCode, public readonly status = 400) { super(code); }
}
export type InteractionFailure = 'provider_session_missing' | 'interaction_mismatch' | 'flow_cookie_missing' | 'flow_cookie_invalid' | 'flow_expired' | 'flow_consumed' | 'flow_mismatch' | 'challenge_expired' | 'login_expired';
// Fixed reason codes only; never include cookie values, OAuth parameters or upstream bodies.
export class InteractionError extends AppError {
  constructor(public readonly reason: InteractionFailure) { super('REAUTH_REQUIRED', 400); }
}
export function requireInteraction(value: unknown, reason: InteractionFailure): asserts value {
  if (!value) throw new InteractionError(reason);
}
export function ensure(value: unknown, code: ErrorCode = 'UPSTREAM_SHAPE_CHANGED'): asserts value {
  if (!value) throw new AppError(code, code === 'FORBIDDEN_SCOPE' ? 403 : 400);
}
export function publicError(error: unknown) {
  return error instanceof AppError ? error : new AppError('STORE_UNAVAILABLE', 503);
}
