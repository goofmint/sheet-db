/**
 * DELETE /api/setup/google-tokens
 *
 * Clear stored Google OAuth tokens (for re-authentication)
 */

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { ConfigRepository } from '../../db/config.repository';

export async function deleteGoogleTokens(c: Context<{ Bindings: Env }>) {
  try {
    const configRepo = new ConfigRepository(c.env);

    // Delete all Google-related tokens from config
    await configRepo.delete('google_access_token');
    await configRepo.delete('google_refresh_token');
    await configRepo.delete('google_token_expires_at');

    return c.json({ success: true, message: 'Tokens cleared' });
  } catch (error) {
    console.error('Error clearing tokens:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to clear tokens' },
      500
    );
  }
}
