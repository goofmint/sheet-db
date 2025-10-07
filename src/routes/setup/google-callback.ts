/**
 * GET /api/setup/google-callback
 *
 * Handle OAuth2 callback from Google
 * Validates state, exchanges code for tokens, and redirects to setup page
 */

import type { Context } from 'hono';
import { getCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../../types/env';
import { ConfigRepository } from '../../db/config.repository';
import { GoogleAuthService } from '../../services/google-auth.service';
import { verifyState } from '../../utils/oauth-state';

export async function getGoogleCallback(c: Context<{ Bindings: Env }>) {
  try {
    // Check if setup is already completed before processing OAuth callback
    const configRepoCheck = new ConfigRepository(c.env);
    const isSetupCompleted = await configRepoCheck.isSetupComplete();

    if (isSetupCompleted) {
      return c.redirect('/setup?step=2&status=already_configured');
    }

    // Extract state and code from query
    const stateFromQuery = c.req.query('state');
    const code = c.req.query('code');

    if (!stateFromQuery) {
      return c.json({ error: 'Missing state parameter' }, 400);
    }

    if (!code) {
      return c.json({ error: 'Missing code parameter' }, 400);
    }

    // Extract signed state from cookie
    const signedStateFromCookie = getCookie(c, 'oauth_state');
    if (!signedStateFromCookie) {
      return c.json({ error: 'Missing state cookie - possible CSRF attack' }, 400);
    }

    // Delete cookie immediately (single-use)
    deleteCookie(c, 'oauth_state', { path: '/api/setup' });

    // Get OAuth state secret from environment
    const secret = c.env.OAUTH_STATE_SECRET;
    if (!secret) {
      return c.json(
        { error: 'OAUTH_STATE_SECRET environment variable not set' },
        500
      );
    }

    // Verify state signature and match
    const isValid = await verifyState(
      signedStateFromCookie,
      stateFromQuery,
      secret
    );

    if (!isValid) {
      return c.json(
        { error: 'State verification failed - possible CSRF attack' },
        400
      );
    }

    // Exchange code for tokens
    const authService = new GoogleAuthService(c.env);
    const tokens = await authService.getTokens(code);

    // Save tokens to config
    const configRepo = new ConfigRepository(c.env);
    await configRepo.saveGoogleTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    });

    // Redirect to setup page with success status
    return c.redirect('/setup?step=2&status=authenticated');
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    // Use generic error code instead of exposing error details in URL
    return c.redirect('/setup?step=1&error=oauth_failed');
  }
}
