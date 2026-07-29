import { type SettingsUpdate, settingsUpdateSchema } from '@shoe-shop/shared';
import { Router } from 'express';

import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody, validBody } from '../../middleware/validate.js';
import { getSettings, toAdminSettings, updateSettings } from '../../services/settings.service.js';

export const adminSettingsRoutes: Router = Router();

adminSettingsRoutes.use(requireAdmin);

adminSettingsRoutes.get('/', async (_req, res) => {
  res.json(toAdminSettings(await getSettings()));
});

adminSettingsRoutes.patch('/', validateBody(settingsUpdateSchema), async (req, res) => {
  res.json(toAdminSettings(await updateSettings(validBody<SettingsUpdate>(req))));
});
