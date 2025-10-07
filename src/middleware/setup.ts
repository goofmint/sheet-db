/**
 * Setup Middleware
 *
 * Protects setup endpoints during initial configuration
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types/env';
import { ConfigRepository } from '../db/config.repository';

/**
 * Middleware to ensure setup is in progress (not completed)
 *
 * This middleware checks if the initial setup has been completed.
 * If setup is already complete, it rejects the request with 403.
 * This prevents unauthorized modification of setup after completion.
 *
 * Use this middleware on setup endpoints that should only be accessible
 * during initial configuration (e.g., OAuth config, sheet initialization).
 */
export async function setupInProgressMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> {
  const configRepo = new ConfigRepository(c.env);
  const isSetupComplete = await configRepo.isSetupComplete();

  if (isSetupComplete) {
    return c.json(
      {
        error: 'Setup already completed. This endpoint is only accessible during initial setup.',
      },
      403
    );
  }

  await next();
}
