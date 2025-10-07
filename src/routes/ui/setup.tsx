/**
 * Initial setup page route
 *
 * Note: The actual HTML is served as a static file from public/setup.html
 * This route only provides an API to check setup status
 */

import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { ConfigRepository } from '../../db/config.repository';

const setup = new Hono<{ Bindings: Env }>();

/**
 * GET /setup/status - Check if setup is completed
 */
setup.get('/status', async (c) => {
  const configRepo = new ConfigRepository(c.env);
  const isSetupCompleted = await configRepo.isSetupComplete();

  return c.json({ completed: isSetupCompleted });
});

export default setup;
