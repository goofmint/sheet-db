/**
 * Authentication API Routes
 * Handles login, logout, and session management
 */

import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { Env, ContextVariables } from '../../types/env';
import { ConfigRepository } from '../../db/config.repository';
import { GoogleSheetsService } from '../../services/google-sheets.service';
import { verifyPassword } from '../../utils/password';
import { requireAuth } from '../../middleware/auth';

const auth = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

/**
 * POST /api/auth/login
 * Authenticate user and create session
 *
 * Request: {
 *   username: string,
 *   password: string
 * }
 *
 * Response: {
 *   success: boolean,
 *   message: string,
 *   user?: { userId: string, username: string }
 * }
 */
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json<{ username: string; password: string }>();
    const { username, password } = body;

    if (!username || !password) {
      return c.json(
        { success: false, message: 'Username and password are required' },
        400
      );
    }

    const configRepo = new ConfigRepository(c.env);

    // Check if setup is completed
    const isSetupComplete = await configRepo.isSetupComplete();
    if (!isSetupComplete) {
      return c.json(
        {
          success: false,
          message: 'System setup not completed. Please complete setup first.',
        },
        503
      );
    }

    // Get Google Sheets access token and sheet ID
    const accessToken = await configRepo.getGoogleAccessToken();
    const sheetId = await configRepo.getSheetId();

    if (!accessToken || !sheetId) {
      return c.json(
        { success: false, message: 'System not configured' },
        500
      );
    }

    const sheetsService = new GoogleSheetsService(accessToken);

    // Get user from _Users sheet (include private columns like _password_hash)
    const usersData = await sheetsService.getSheetData(sheetId, '_Users', {
      includePrivateColumns: true,
    });
    const user = usersData.find((row) => row.username === username);

    if (!user) {
      return c.json(
        { success: false, message: 'Invalid username or password' },
        401
      );
    }

    // Verify password
    const passwordHash = user._password_hash as string;
    const isValid = await verifyPassword(password, passwordHash);

    if (!isValid) {
      return c.json(
        { success: false, message: 'Invalid username or password' },
        401
      );
    }

    // Check user status
    if (user.status !== 'active') {
      return c.json(
        { success: false, message: 'User account is not active' },
        403
      );
    }

    // Get user roles
    const userId = user.object_id as string;
    const rolesData = await sheetsService.getSheetData(sheetId, '_Roles');
    const userRoles: string[] = [];

    for (const role of rolesData) {
      const usersInRole = role.users as string;
      let userIds: string[] = [];
      if (usersInRole) {
        try {
          const parsed = JSON.parse(usersInRole);
          if (Array.isArray(parsed)) {
            userIds = parsed;
          }
        } catch (err) {
          console.warn('[auth] 役割データの JSON 解析に失敗したぞ:', err);
          continue;
        }
      }
      if (userIds.includes(userId)) {
        userRoles.push(role.name as string);
      }
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const sessionTimeout = await configRepo.getSetting('session_timeout');
    const parsedTimeout = sessionTimeout ? Number(sessionTimeout) : NaN;
    const timeoutSeconds = Number.isFinite(parsedTimeout) ? parsedTimeout : 3600; // Default 1 hour
    const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);

    await configRepo.saveSession(
      sessionId,
      {
        userId,
        username: username,
        roles: userRoles,
      },
      expiresAt
    );

    // Set session cookie
    setCookie(c, 'session_id', sessionId, {
      path: '/',
      httpOnly: true,
      secure: c.env.ENVIRONMENT === 'production',
      sameSite: 'Lax',
      expires: expiresAt,
    });

    return c.json({
      success: true,
      message: 'Login successful',
      user: {
        userId,
        username,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json(
      {
        success: false,
        message: 'Login failed',
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * POST /api/auth/logout
 * End user session
 *
 * Response: {
 *   success: boolean,
 *   message: string
 * }
 */
auth.post('/logout', requireAuth, async (c) => {
  try {
    const configRepo = new ConfigRepository(c.env);
    const sessionId = c.req.header('cookie')?.match(/session_id=([^;]+)/)?.[1];

    if (sessionId) {
      await configRepo.deleteSession(sessionId);
    }

    // Delete session cookie
    deleteCookie(c, 'session_id', {
      path: '/',
    });

    return c.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json(
      {
        success: false,
        message: 'Logout failed',
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * GET /api/auth/me
 * Get current user session info
 *
 * Response: {
 *   userId: string,
 *   username: string,
 *   roles: string[]
 * }
 */
auth.get('/me', requireAuth, async (c) => {
  const userSession = c.get('userSession');
  return c.json(userSession);
});

export default auth;
