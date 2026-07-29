import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Error as MongooseError } from 'mongoose';
import { ZodError } from 'zod';

import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
};

/** MongoDB's duplicate-key error, which has no named type in the driver. */
function isDuplicateKeyError(error: unknown): error is { code: number; keyValue: object } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

/**
 * Translate anything thrown anywhere in the app into the one response shape the
 * client knows how to read: `{ error: { message, code, details? } }`.
 *
 * Express 5 forwards rejected promises from async handlers here automatically,
 * so there is no `asyncHandler` wrapper anywhere in this codebase.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const apiError = toApiError(error);

  if (apiError.expected) {
    logger.warn(
      { code: apiError.code, status: apiError.status, path: req.originalUrl },
      apiError.message,
    );
  } else {
    // Genuine faults keep their stack. Expected ones (a sold-out size, a bad
    // PIN code) would otherwise bury real problems in noise.
    logger.error(
      { err: error, code: apiError.code, path: req.originalUrl },
      'Unhandled server error',
    );
  }

  res.status(apiError.status).json({
    error: {
      message: apiError.message,
      code: apiError.code,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
    },
  });
};

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return ApiError.validation(
      'Some of the details you entered are not valid',
      error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    );
  }

  if (error instanceof MongooseError.ValidationError) {
    return ApiError.validation(
      'Some of the details you entered are not valid',
      Object.values(error.errors).map((e) => ({ field: e.path, message: e.message })),
    );
  }

  if (error instanceof MongooseError.CastError) {
    return ApiError.badRequest(`"${String(error.value)}" is not a valid ${error.path}`);
  }

  if (isDuplicateKeyError(error)) {
    const field = Object.keys(error.keyValue)[0] ?? 'value';
    return ApiError.conflict('DUPLICATE', `That ${field} is already in use`);
  }

  // Anything reaching here is unexpected. Never leak its message to the client
  // in production — it may carry a connection string or an internal path.
  return ApiError.internal(
    isProduction
      ? 'Something went wrong. Please try again.'
      : error instanceof Error
        ? error.message
        : String(error),
    error,
  );
}
