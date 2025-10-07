/**
 * GET /api/setup/google-auth
 *
 * Generate OAuth2 authorization URL
 */

import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import type { Env } from '../../types/env';
import { ConfigRepository } from '../../db/config.repository';
import { GoogleAuthService } from '../../services/google-auth.service';
import { signState } from '../../utils/oauth-state';

export async function getGoogleAuth(c: Context<{ Bindings: Env }>) {
  try {
    // Check if setup is already completed
    const configRepo = new ConfigRepository(c.env);
    const isSetupCompleted = await configRepo.isSetupComplete();

    if (isSetupCompleted) {
      return c.json(
        { error: 'Setup already completed. OAuth authentication is not allowed.' },
        403
      );
    }

    const authService = new GoogleAuthService(c.env);

    // Generate random state token
    const stateToken = crypto.randomUUID();

    // Get OAuth state secret from environment
    const secret = c.env.OAUTH_STATE_SECRET;
    if (!secret) {
      return c.json(
        { error: 'OAUTH_STATE_SECRET environment variable not set' },
        500
      );
    }

    // Sign state token
    const signedState = await signState(stateToken, secret);

    // Set signed state as HttpOnly, Secure, SameSite=Lax cookie
    setCookie(c, 'oauth_state', signedState, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 600, // 10 minutes
      path: '/api/setup',
    });

    // Get authorization URL
    const authUrl = await authService.getAuthUrl(stateToken);

    return c.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return c.json(
      {
        error: 'Failed to generate authorization URL',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}
