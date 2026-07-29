import { adminLoginSchema } from '@shoe-shop/shared';
import { Router } from 'express';

import { login, logout, me, refresh } from '../../controllers/auth.controller.js';
import { loginLimiter } from '../../middleware/rateLimit.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';

export const authRoutes: Router = Router();

authRoutes.post('/login', loginLimiter, validateBody(adminLoginSchema), login);
authRoutes.post('/refresh', refresh);
authRoutes.post('/logout', logout);
authRoutes.get('/me', requireAdmin, me);
