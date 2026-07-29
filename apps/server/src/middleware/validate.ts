import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

import { ApiError } from '../utils/ApiError.js';

/**
 * Where the validated data is stashed. Handlers read `req.valid.body` rather
 * than `req.body`, so it is impossible to accidentally use the raw, unvalidated
 * input: the typed value and the untrusted one have different names.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      valid: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

function formatIssues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

type Source = 'body' | 'query' | 'params';

function validateSource(schema: ZodType, source: Source): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const issues = formatIssues(result.error);
      next(
        ApiError.validation(
          issues[0]?.message ?? 'Some of the details you entered are not valid',
          issues,
        ),
      );
      return;
    }

    req.valid ??= {};
    req.valid[source] = result.data;
    next();
  };
}

/**
 * Validate the JSON body against a shared schema.
 *
 * The schema comes from `@shoe-shop/shared`, which is the same object the React
 * form validates with — so the browser and the server can never disagree about
 * what a valid payload is.
 */
export const validateBody = (schema: ZodType): RequestHandler => validateSource(schema, 'body');

/**
 * Validate the query string. Zod coerces here (`?page=2` is the string "2"),
 * which is why handlers must read `req.valid.query` to get real numbers.
 */
export const validateQuery = (schema: ZodType): RequestHandler => validateSource(schema, 'query');

export const validateParams = (schema: ZodType): RequestHandler => validateSource(schema, 'params');

/** Typed accessors, so handlers do not repeat the cast at every call site. */
export function validBody<T>(req: Request): T {
  return req.valid.body as T;
}

export function validQuery<T>(req: Request): T {
  return req.valid.query as T;
}

export function validParams<T>(req: Request): T {
  return req.valid.params as T;
}
