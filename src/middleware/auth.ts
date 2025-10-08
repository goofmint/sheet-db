/**
 * Authentication Middleware
 * Provides session-based authentication and role-based access control
 */

import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env, ContextVariables, UserSession } from '../types/env';
import { ConfigRepository } from '../db/config.repository';
import { SessionRepository } from '../db/session.repository';
import { GoogleSheetsService } from '../services/google-sheets.service';

// Re-export UserSession for convenience
export type { UserSession };

/**
 * Middleware to require authentication
 * Verifies session cookie and loads user data
 * Redirects to login page for HTML requests, returns 401 for API requests
 */
export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: ContextVariables }>,
  next: Next
) {
  const sessionId = getCookie(c, 'session_id');

  if (!sessionId) {
    // Check if this is an HTML page request or API request
    const acceptHeader = c.req.header('accept') || '';
    const isHtmlRequest = acceptHeader.includes('text/html');

    if (isHtmlRequest) {
      const currentPath = c.req.path;
      return c.redirect(`/login?error=unauthorized&redirect=${encodeURIComponent(currentPath)}`);
    }

    return c.json({ error: 'Authentication required' }, 401);
  }

  // Get session from user_sessions table
  const sessionRepo = new SessionRepository(c.env);
  const session = await sessionRepo.getSession(sessionId);

  if (!session) {
    // Check if this is an HTML page request or API request
    const acceptHeader = c.req.header('accept') || '';
    const isHtmlRequest = acceptHeader.includes('text/html');

    if (isHtmlRequest) {
      const currentPath = c.req.path;
      return c.redirect(`/login?error=unauthorized&redirect=${encodeURIComponent(currentPath)}`);
    }

    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  // Fetch user details from Google Sheets
  const configRepo = new ConfigRepository(c.env);
  const accessToken = await configRepo.getGoogleAccessToken();
  const sheetId = await configRepo.getSheetId();

  if (!accessToken || !sheetId) {
    return c.json({ error: 'System not configured' }, 500);
  }

  const sheetsService = new GoogleSheetsService(accessToken);

  // Get user from _Users sheet
  const usersData = await sheetsService.getSheetData(sheetId, '_Users');
  const user = usersData.find((row) => row.object_id === session.userId);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const username = user.username as string;

  // Get user roles from _Roles sheet
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
        console.warn('[auth middleware] Failed to parse role users JSON:', err);
        continue;
      }
    }
    if (userIds.includes(session.userId)) {
      userRoles.push(role.name as string);
    }
  }

  // Store user session in context for downstream handlers
  const userSession: UserSession = {
    userId: session.userId,
    username,
    roles: userRoles,
  };
  c.set('userSession', userSession);

  await next();
}

/**
 * Middleware to require Administrator role
 * Must be used after requireAuth middleware
 * Redirects to login page with error for HTML requests, returns 403 for API requests
 */
export async function requireAdministrator(
  c: Context<{ Bindings: Env; Variables: ContextVariables }>,
  next: Next
) {
  const userSession = c.get('userSession') as UserSession | undefined;

  if (!userSession) {
    const acceptHeader = c.req.header('accept') || '';
    const isHtmlRequest = acceptHeader.includes('text/html');

    if (isHtmlRequest) {
      return c.redirect('/login?error=unauthorized');
    }

    return c.json({ error: 'Authentication required' }, 401);
  }

  // Check if user has Administrator role
  const configRepo = new ConfigRepository(c.env);
  const accessToken = await configRepo.getGoogleAccessToken();
  const sheetId = await configRepo.getSheetId();

  if (!accessToken || !sheetId) {
    return c.json({ error: 'System not configured' }, 500);
  }

  const sheetsService = new GoogleSheetsService(accessToken);

  // Get all roles
  const rolesData = await sheetsService.getSheetData(sheetId, '_Roles');
  const adminRole = rolesData.find((role) => role.name === 'Administrator');

  if (!adminRole) {
    return c.json({ error: 'Administrator role not found' }, 500);
  }

  // Check if user is in Administrator role
  let adminUsers: string[] = [];
  const adminUsersRaw = adminRole.users;

  if (adminUsersRaw && typeof adminUsersRaw === 'string') {
    try {
      const parsed = JSON.parse(adminUsersRaw);
      if (Array.isArray(parsed)) {
        adminUsers = parsed;
      } else {
        console.error('[requireAdministrator] Parsed users is not an array:', parsed);
      }
    } catch (error) {
      console.error('[requireAdministrator] Failed to parse adminRole.users:', error);
    }
  }

  if (!adminUsers.includes(userSession.userId)) {
    const acceptHeader = c.req.header('accept') || '';
    const isHtmlRequest = acceptHeader.includes('text/html');

    if (isHtmlRequest) {
      return c.redirect('/login?error=forbidden');
    }

    return c.json(
      { error: 'Administrator role required for this operation' },
      403
    );
  }

  await next();
}
