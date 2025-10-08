/**
 * Authentication API Routes
 * Handles login, logout, and session management
 */

import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { Env, ContextVariables } from '../../types/env';
import { AuthService } from '../../services/auth.service';
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

    const authService = new AuthService(c.env);
    const result = await authService.login({ username, password });

    if (!result.success) {
      const statusCode =
        result.message === 'System setup not completed. Please complete setup first.'
          ? 503
          : result.message === 'System not configured'
            ? 500
            : result.message === 'User account is not active'
              ? 403
              : 401;

      return c.json(
        { success: false, message: result.message },
        statusCode
      );
    }

    // Set session cookie
    setCookie(c, 'session_id', result.sessionId!, {
      path: '/',
      httpOnly: true,
      secure: c.env.ENVIRONMENT === 'production',
      sameSite: 'Lax',
      expires: result.expiresAt!,
    });

    return c.json({
      success: true,
      message: result.message,
      user: result.user,
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
    const sessionId = c.req.header('cookie')?.match(/session_id=([^;]+)/)?.[1];

    if (sessionId) {
      const authService = new AuthService(c.env);
      await authService.logout(sessionId);
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
