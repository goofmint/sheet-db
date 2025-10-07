/**
 * POST /api/setup/google-config
 *
 * Save Google OAuth credentials
 */

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { ConfigRepository } from '../../db/config.repository';

export async function postGoogleConfig(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<{
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }>();

    // Validate input
    if (!body.clientId || !body.clientSecret || !body.redirectUri) {
      return c.json(
        { error: 'Missing required fields: clientId, clientSecret, redirectUri' },
        400
      );
    }

    // Save credentials
    const configRepo = new ConfigRepository(c.env);
    await configRepo.saveGoogleCredentials({
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      redirectUri: body.redirectUri,
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Error saving Google config:', error);
    return c.json(
      {
        error: 'Failed to save Google credentials',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}
