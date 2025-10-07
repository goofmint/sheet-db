/**
 * Setup API Routes
 *
 * Handles initial setup flow:
 * 1. Google OAuth2 credentials configuration
 * 2. OAuth2 authentication flow
 * 3. Sheet selection and initialization
 * 4. Final configuration (file storage, admin user, master key)
 */

import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../types/env';
import { ConfigRepository } from '../db/config.repository';
import { GoogleAuthService } from '../services/google-auth.service';
import { GoogleSheetsService } from '../services/google-sheets.service';
import { signState, verifyState } from '../utils/oauth-state';
import type { CompleteSetupRequest, SheetInitResult } from '../types/google';

const setup = new Hono<{ Bindings: Env }>();

/**
 * POST /api/setup/google-config
 *
 * Save Google OAuth2 credentials to config table
 */
setup.post('/google-config', async (c) => {
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
});

/**
 * GET /api/setup/google-auth
 *
 * Initiate Google OAuth2 flow
 * Returns authorization URL and sets signed state cookie
 */
setup.get('/google-auth', async (c) => {
  try {
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
});

/**
 * GET /api/setup/google-callback
 *
 * Handle OAuth2 callback from Google
 * Validates state, exchanges code for tokens, and redirects to setup page
 */
setup.get('/google-callback', async (c) => {
  try {
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
    return c.redirect(
      `/setup?step=1&error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Authentication failed'
      )}`
    );
  }
});

/**
 * GET /api/setup/sheets
 *
 * Get list of available Google Sheets
 */
setup.get('/sheets', async (c) => {
  try {
    const configRepo = new ConfigRepository(c.env);
    const accessToken = await configRepo.getGoogleAccessToken();

    if (!accessToken) {
      return c.json(
        { error: 'No access token available. Please authenticate first.' },
        401
      );
    }

    const sheetsService = new GoogleSheetsService(accessToken);
    const sheets = await sheetsService.listSpreadsheets();

    return c.json({ sheets });
  } catch (error) {
    console.error('Error listing sheets:', error);
    return c.json(
      {
        error: 'Failed to list spreadsheets',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * POST /api/setup/initialize-sheet
 *
 * Initialize required sheets (_Users, _Roles, _Files) with headers
 */
setup.post('/initialize-sheet', async (c) => {
  try {
    const body = await c.req.json<{ sheetId: string }>();

    if (!body.sheetId) {
      return c.json({ error: 'Missing sheetId' }, 400);
    }

    const configRepo = new ConfigRepository(c.env);
    const accessToken = await configRepo.getGoogleAccessToken();

    if (!accessToken) {
      return c.json(
        { error: 'No access token available. Please authenticate first.' },
        401
      );
    }

    const sheetsService = new GoogleSheetsService(accessToken);
    const result: SheetInitResult = {
      success: true,
      createdSheets: [],
      errors: [],
    };

    // Define required sheets with their headers
    const requiredSheets = [
      {
        title: '_Users',
        headers: [
          'id',
          'email',
          'name',
          'password_hash',
          'role',
          'created_at',
          'updated_at',
        ],
      },
      {
        title: '_Roles',
        headers: ['id', 'name', 'permissions', 'created_at', 'updated_at'],
      },
      {
        title: '_Files',
        headers: [
          'id',
          'name',
          'path',
          'size',
          'mime_type',
          'uploaded_by',
          'created_at',
        ],
      },
    ];

    // Create each sheet if it doesn't exist (idempotent)
    for (const sheet of requiredSheets) {
      try {
        const exists = await sheetsService.sheetExists(body.sheetId, sheet.title);
        if (!exists) {
          await sheetsService.createSheetWithHeaders(
            body.sheetId,
            sheet.title,
            sheet.headers
          );
          result.createdSheets.push(sheet.title);
        }
      } catch (error) {
        const errorMsg = `Failed to create ${sheet.title}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        result.errors.push(errorMsg);
        result.success = false;
      }
    }

    return c.json(result);
  } catch (error) {
    console.error('Error initializing sheets:', error);
    return c.json(
      {
        success: false,
        createdSheets: [],
        errors: [error instanceof Error ? error.message : String(error)],
      },
      500
    );
  }
});

/**
 * POST /api/setup/complete
 *
 * Complete initial setup with final configuration
 */
setup.post('/complete', async (c) => {
  try {
    const body = await c.req.json<CompleteSetupRequest>();

    // Validate input
    if (!body.sheetId || !body.sheetName) {
      return c.json({ error: 'Missing sheetId or sheetName' }, 400);
    }

    if (!body.fileStorage || !body.fileStorage.type) {
      return c.json({ error: 'Missing file storage configuration' }, 400);
    }

    if (!body.adminUser || !body.adminUser.userId || !body.adminUser.password) {
      return c.json({ error: 'Missing admin user configuration' }, 400);
    }

    if (!body.masterKey) {
      return c.json({ error: 'Missing master key' }, 400);
    }

    const configRepo = new ConfigRepository(c.env);

    // 1. Save sheet configuration
    await configRepo.saveSheetConfig(body.sheetId, body.sheetName);

    // 2. Save file storage configuration
    await configRepo.saveFileStorageConfig(body.fileStorage);

    // 3. Save master key
    await configRepo.saveMasterKey(body.masterKey);

    // 4. Create initial admin user in _Users sheet
    const accessToken = await configRepo.getGoogleAccessToken();
    if (!accessToken) {
      return c.json(
        { error: 'No access token available. Please authenticate first.' },
        401
      );
    }

    const sheetsService = new GoogleSheetsService(accessToken);

    // Hash password (simple for now - should use bcrypt in production)
    const encoder = new TextEncoder();
    const data = encoder.encode(body.adminUser.password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const passwordHash = btoa(
      String.fromCharCode(...new Uint8Array(hashBuffer))
    );

    // Add admin user to _Users sheet
    await sheetsService.appendRow(body.sheetId, '_Users', [
      body.adminUser.userId,
      '', // email (empty for now)
      'Administrator',
      passwordHash,
      'admin',
      new Date().toISOString(),
      new Date().toISOString(),
    ]);

    // 5. Mark setup as completed
    await configRepo.markSetupCompleted();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error completing setup:', error);
    return c.json(
      {
        error: 'Failed to complete setup',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

export default setup;
