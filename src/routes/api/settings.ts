/**
 * Settings API Routes
 * Provides endpoints for managing system configuration settings
 * Requires Administrator role for access
 */

import { Hono } from 'hono';
import type { Env, ContextVariables } from '../../types/env';
import { SettingsService } from '../../services/settings.service';
import type { SettingValue } from '../../types/settings';
import {
  requireAuth,
  requireAdministrator,
  type UserSession,
} from '../../middleware/auth';

const app = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

/**
 * GET /api/settings
 * Get all settings with their definitions
 * Requires Administrator role
 *
 * Response: {
 *   settings: Record<string, SettingValue>,
 *   definitions: SettingDefinition[]
 * }
 */
app.get('/', requireAuth, requireAdministrator, async (c) => {
  try {
    const settingsService = new SettingsService(c.env);
    const result = await settingsService.getAllSettings();

    return c.json(result);
  } catch (error) {
    console.error('Failed to get settings:', error);
    return c.json(
      {
        error: 'Failed to get settings',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * PUT /api/settings
 * Update a single setting value
 * Requires Administrator role
 *
 * Request: {
 *   key: string,
 *   value: string | number | boolean | string[]
 * }
 *
 * Response: {
 *   success: boolean,
 *   message: string
 * }
 */
app.put('/', requireAuth, requireAdministrator, async (c) => {
  try {
    const body = await c.req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return c.json(
        {
          success: false,
          message: 'Missing required fields: key and value',
        },
        400
      );
    }

    const userSession = c.get('userSession') as UserSession;
    const settingsService = new SettingsService(c.env);

    const result = await settingsService.updateSetting({
      key,
      value: value as SettingValue,
      userId: userSession.userId,
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    if (!result.success) {
      const statusCode = result.message.startsWith('Unknown setting')
        ? 400
        : result.message.startsWith('Invalid value')
          ? 400
          : 500;

      return c.json(result, statusCode);
    }

    return c.json(result);
  } catch (error) {
    console.error('Failed to update setting:', error);
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * PUT /api/settings/bulk
 * Update multiple settings at once
 * Requires Administrator role
 *
 * Request: {
 *   settings: Record<string, string | number | boolean | string[]>
 * }
 *
 * Response: {
 *   success: boolean,
 *   message: string,
 *   updated: number
 * }
 */
app.put('/bulk', requireAuth, requireAdministrator, async (c) => {
  try {
    const body = await c.req.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return c.json(
        {
          success: false,
          message: 'Missing or invalid settings object',
          updated: 0,
        },
        400
      );
    }

    const userSession = c.get('userSession') as UserSession;
    const settingsService = new SettingsService(c.env);

    const result = await settingsService.bulkUpdateSettings({
      settings: settings as Record<string, SettingValue>,
      userId: userSession.userId,
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json(result);
  } catch (error) {
    console.error('Failed to bulk update settings:', error);
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        updated: 0,
      },
      500
    );
  }
});

export default app;
