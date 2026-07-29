/**
 * Every failure the API reports deliberately goes through this class, so the
 * response body has exactly one shape:
 *
 *   { error: { message, code, details? } }
 *
 * The client then normalises errors once, in RTK Query's
 * `transformErrorResponse`, instead of guessing at a different structure per
 * endpoint.
 *
 * `code` is a stable machine-readable string. The UI branches on it (to show a
 * "size just sold out" prompt rather than a generic toast); `message` is for
 * humans and may be reworded freely.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  /**
   * Marks errors that are a normal part of operating the shop (bad input, a
   * sold-out size) as opposed to genuine faults. The error handler logs the
   * former at `warn` and the latter at `error` with a stack, so real problems
   * stay visible instead of drowning in validation noise.
   */
  readonly expected: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { details?: unknown; expected?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.expected = options.expected ?? status < 500;
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, { details });
  }

  static validation(message: string, details?: unknown): ApiError {
    return new ApiError(422, 'VALIDATION_FAILED', message, { details });
  }

  static unauthorized(message = 'Please sign in to continue'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have access to that'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Not found'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(409, code, message, { details });
  }

  static tooManyRequests(message = 'Too many requests. Please wait and try again.'): ApiError {
    return new ApiError(429, 'RATE_LIMITED', message);
  }

  /** A dependency we need is not configured — a deployment problem, not a user one. */
  static notConfigured(what: string): ApiError {
    return new ApiError(503, 'NOT_CONFIGURED', `${what} is not configured on this server`, {
      expected: false,
    });
  }

  static internal(message = 'Something went wrong', cause?: unknown): ApiError {
    return new ApiError(500, 'INTERNAL_ERROR', message, { cause, expected: false });
  }
}
