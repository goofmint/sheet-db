/**
 * Authentication Middleware
 * Provides session-based authentication and role-based access control
 */

import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env, ContextVariables, UserSession } from '../types/env';
import { ConfigRepository } from '../db/config.repository';
import { GoogleSheetsService } from '../services/google-sheets.service';

// Re-export UserSession for convenience
export type { UserSession };

/**
 * Middleware to require authentication
 * Verifies session cookie and loads user data
 */
export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: ContextVariables }>,
  next: Next
) {
  const sessionId = getCookie(c, 'session_id');

  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Get session from D1 database
  const configRepo = new ConfigRepository(c.env);
  const sessionData = await configRepo.getSession(sessionId);

  if (!sessionData) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  // Store user session in context for downstream handlers
  c.set('userSession', sessionData as UserSession);

  await next();
}

/**
 * Middleware to require Administrator role
 * Must be used after requireAuth middleware
 */
export async function requireAdministrator(
  c: Context<{ Bindings: Env; Variables: ContextVariables }>,
  next: Next
) {
  const userSession = c.get('userSession') as UserSession | undefined;

  if (!userSession) {
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
  const adminUsersRaw = adminRole.users as string;
  const adminUsers = adminUsersRaw ? JSON.parse(adminUsersRaw) : [];

  if (!adminUsers.includes(userSession.userId)) {
    return c.json(
      { error: 'Administrator role required for this operation' },
      403
    );
  }

  await next();
}
