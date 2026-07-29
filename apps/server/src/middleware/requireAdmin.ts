import type { NextFunction, Request, Response } from 'express';

import type { AdminDocument } from '../models/Admin.js';
import { verifyToken } from '../services/auth.service.js';
import { ApiError } from '../utils/ApiError.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminDocument;
    }
  }
}

/**
 * Gate for every `/api/admin/*` route except login and refresh.
 *
 * Reads the bearer token, verifies it, and attaches the admin. Anything that
 * fails verification — expired, forged, issued before the last password change,
 * belonging to a deleted account — comes back as a 401 with no detail about
 * which of those it was.
 */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized();
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw ApiError.unauthorized();
    }

    req.admin = await verifyToken(token, 'access');
    next();
  } catch (error) {
    next(error);
  }
}
