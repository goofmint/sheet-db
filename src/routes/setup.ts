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
import { setupInProgressMiddleware } from '../middleware/setup';

const setup = new Hono<{ Bindings: Env }>();

/**
 * DELETE /api/setup/google-tokens
 *
 * Clear stored Google OAuth tokens (for re-authentication)
 */
setup.delete('/google-tokens', async (c) => {
  try {
    const configRepo = new ConfigRepository(c.env);

    // Delete all Google-related tokens from config
    await configRepo.set('google_access_token', '', 'Cleared');
    await configRepo.set('google_refresh_token', '', 'Cleared');
    await configRepo.set('google_token_expires_at', '', 'Cleared');

    return c.json({ success: true, message: 'Tokens cleared' });
  } catch (error) {
    console.error('Error clearing tokens:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to clear tokens' },
      500
    );
  }
});

/**
 * POST /api/setup/google-config
 *
 * Save Google OAuth2 credentials to config table
 */
setup.post('/google-config', setupInProgressMiddleware, async (c) => {
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
});

/**
 * GET /api/setup/google-callback
 *
 * Handle OAuth2 callback from Google
 * Validates state, exchanges code for tokens, and redirects to setup page
 */
setup.get('/google-callback', async (c) => {
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
 * POST /api/setup/initialize-sheet-stream
 *
 * Initialize required sheets (_Users, _Roles, _Files) with Server-Sent Events progress
 */
setup.post('/initialize-sheet-stream', setupInProgressMiddleware, async (c) => {
  try {
    const body = await c.req.json<{ sheetId: string; sheetName: string }>();

    if (!body.sheetId || !body.sheetName) {
      return c.json({ error: 'Missing sheetId or sheetName' }, 400);
    }

    const configRepo = new ConfigRepository(c.env);
    const accessToken = await configRepo.getGoogleAccessToken();

    if (!accessToken) {
      return c.json(
        { error: 'No access token available. Please authenticate first.' },
        401
      );
    }

    // Save sheet configuration
    await configRepo.saveSheetConfig(body.sheetId, body.sheetName);

    // Create Server-Sent Events stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const sheetsService = new GoogleSheetsService(accessToken);

          // Define required sheets with their headers and column definitions (per design.md)
          const requiredSheets = [
            {
              title: '_Users',
              headers: [
                'object_id',
                'username',
                '_password_hash',
                'email',
                'name',
                'status',
                'created_at',
              ],
              columnDefs: [
                { type: 'string', unique: true },
                { type: 'string', unique: true, required: true },
                { type: 'string', required: true },
                { type: 'email', unique: true },
                { type: 'string' },
                { type: 'string' },
                { type: 'date' },
              ],
            },
            {
              title: '_Roles',
              headers: ['object_id', 'name', 'users', 'created_at'],
              columnDefs: [
                { type: 'string', unique: true },
                { type: 'string', unique: true, required: true },
                { type: 'array' },
                { type: 'date' },
              ],
            },
            {
              title: '_Files',
              headers: [
                'object_id',
                'original_name',
                'storage_provider',
                'storage_path',
                'content_type',
                'size_bytes',
                'owner_id',
                'public_read',
                'public_write',
                'users_read',
                'users_write',
                'roles_read',
                'roles_write',
                'created_at',
              ],
              columnDefs: [
                { type: 'string', unique: true },
                { type: 'string', required: true },
                { type: 'string', pattern: '^(r2|google_drive)$' },
                { type: 'string' },
                { type: 'string' },
                { type: 'number', min: 0 },
                { type: 'string' },
                { type: 'boolean' },
                { type: 'boolean' },
                { type: 'array' },
                { type: 'array' },
                { type: 'array' },
                { type: 'array' },
                { type: 'date' },
              ],
            },
          ];

          const createdSheets: string[] = [];
          const errors: string[] = [];

          // Create each sheet sequentially (one-by-one to avoid Workers execution time limit)
          for (const sheet of requiredSheets) {
            try {
              send('progress', { message: `Checking ${sheet.title}...`, sheet: sheet.title, status: 'checking' });

              const exists = await sheetsService.sheetExists(body.sheetId, sheet.title);

              if (!exists) {
                send('progress', { message: `Creating ${sheet.title}...`, sheet: sheet.title, status: 'creating' });

                await sheetsService.createSheetWithHeaders(
                  body.sheetId,
                  sheet.title,
                  sheet.headers,
                  sheet.columnDefs
                );

                createdSheets.push(sheet.title);
                send('progress', { message: `✓ ${sheet.title} created successfully`, sheet: sheet.title, status: 'created' });
              } else {
                send('progress', { message: `✓ ${sheet.title} already exists`, sheet: sheet.title, status: 'exists' });
              }
            } catch (error) {
              const errorMsg = `Failed to create ${sheet.title}: ${
                error instanceof Error ? error.message : String(error)
              }`;
              errors.push(errorMsg);
              send('error', { message: errorMsg, sheet: sheet.title });
            }
          }

          // Send completion event
          send('complete', {
            success: errors.length === 0,
            createdSheets,
            errors
          });

          controller.close();
        } catch (error) {
          send('error', {
            message: error instanceof Error ? error.message : String(error)
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in initialize-sheet-stream:', error);
    return c.json(
      {
        error: 'Failed to start initialization',
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
setup.post('/initialize-sheet', setupInProgressMiddleware, async (c) => {
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

    // Define required sheets with their headers and column definitions (per design.md)
    const requiredSheets = [
      {
        title: '_Users',
        headers: [
          'object_id',
          'username',
          '_password_hash',
          'email',
          'name',
          'status',
          'created_at',
        ],
        columnDefs: [
          { type: 'string', unique: true },
          { type: 'string', unique: true, required: true },
          { type: 'string', required: true },
          { type: 'email', unique: true },
          { type: 'string' },
          { type: 'string' },
          { type: 'date' },
        ],
      },
      {
        title: '_Roles',
        headers: ['object_id', 'name', 'users', 'created_at'],
        columnDefs: [
          { type: 'string', unique: true },
          { type: 'string', unique: true, required: true },
          { type: 'array' },
          { type: 'date' },
        ],
      },
      {
        title: '_Files',
        headers: [
          'object_id',
          'original_name',
          'storage_provider',
          'storage_path',
          'content_type',
          'size_bytes',
          'owner_id',
          'public_read',
          'public_write',
          'users_read',
          'users_write',
          'roles_read',
          'roles_write',
          'created_at',
        ],
        columnDefs: [
          { type: 'string', unique: true },
          { type: 'string', required: true },
          { type: 'string', pattern: '^(r2|google_drive)$' },
          { type: 'string' },
          { type: 'string' },
          { type: 'number', min: 0 },
          { type: 'string' },
          { type: 'boolean' },
          { type: 'boolean' },
          { type: 'array' },
          { type: 'array' },
          { type: 'array' },
          { type: 'array' },
          { type: 'date' },
        ],
      },
    ];

    // Create each sheet sequentially (one-by-one to avoid Workers execution time limit)
    for (const sheet of requiredSheets) {
      try {
        console.log(`[Initialize Sheet] Checking ${sheet.title}...`);
        const exists = await sheetsService.sheetExists(body.sheetId, sheet.title);
        if (!exists) {
          console.log(`[Initialize Sheet] Creating ${sheet.title}...`);
          await sheetsService.createSheetWithHeaders(
            body.sheetId,
            sheet.title,
            sheet.headers,
            sheet.columnDefs
          );
          console.log(`[Initialize Sheet] ✓ ${sheet.title} created successfully`);
          result.createdSheets.push(sheet.title);
        } else {
          console.log(`[Initialize Sheet] ✓ ${sheet.title} already exists`);
        }
      } catch (error) {
        const errorMsg = `Failed to create ${sheet.title}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        console.error(`[Initialize Sheet] ✗ ${errorMsg}`);
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
setup.post('/complete', setupInProgressMiddleware, async (c) => {
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

    // Double-check setup is not already completed to prevent re-running
    const isAlreadyCompleted = await configRepo.isSetupComplete();
    if (isAlreadyCompleted) {
      return c.json(
        { error: 'Setup is already completed. Cannot re-run setup.' },
        409
      );
    }

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

    // Add admin user to _Users sheet (using correct column structure)
    await sheetsService.appendRow(body.sheetId, '_Users', [
      crypto.randomUUID(), // object_id
      body.adminUser.userId, // username
      passwordHash, // _password_hash
      '', // email (empty for now)
      'Administrator', // name
      'active', // status
      new Date().toISOString(), // created_at
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
