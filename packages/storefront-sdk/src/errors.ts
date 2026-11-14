export type ErrorCode = 'timeout' | 'network' | 'unauthorized' | 'forbidden' | 'not_found' | 'rate_limited' | 'incompatible' | 'invalid_request' | 'server' | 'graphql';
export class OssApiError extends Error {
  constructor(message: string, readonly code: ErrorCode, readonly status?: number, readonly requestId?: string, readonly retryable = false) { super(message); this.name = 'OssApiError'; }
}
export function fromStatus(status: number, requestId?: string): OssApiError {
  if (status === 401) return new OssApiError('The storefront credential was rejected. It may be expired, revoked or disabled.', 'unauthorized', status, requestId);
  if (status === 403) return new OssApiError('This storefront is not permitted to do that.', 'forbidden', status, requestId);
  if (status === 404) return new OssApiError('Not found.', 'not_found', status, requestId);
  if (status === 409 || status === 426) return new OssApiError('This SDK version is not compatible with the commerce API.', 'incompatible', status, requestId);
  if (status === 429) return new OssApiError('Rate limited.', 'rate_limited', status, requestId, true);
  if (status >= 500) return new OssApiError('The commerce API is unavailable.', 'server', status, requestId, status === 502 || status === 503 || status === 504);
  return new OssApiError('The request was rejected.', 'invalid_request', status, requestId);
}
