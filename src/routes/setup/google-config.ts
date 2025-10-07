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

    // Validate redirectUri format
    try {
      const url = new URL(body.redirectUri);
      if (!url.protocol.startsWith('http')) {
        return c.json(
          { error: 'redirectUri must use http:// or https:// protocol' },
          400
        );
      }
    } catch {
      return c.json(
        { error: 'redirectUri must be a valid URL' },
        400
      );
    }

    // Validate clientId format (Google OAuth client IDs end with .apps.googleusercontent.com)
    if (!body.clientId.endsWith('.apps.googleusercontent.com')) {
      return c.json(
        { error: 'clientId must be a valid Google OAuth client ID' },
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
