/**
 * Settings API Routes
 * Provides endpoints for managing system configuration settings
 * Requires Administrator role for access
 */

import { Hono } from 'hono';
import type { Env, ContextVariables } from '../../types/env';
import { ConfigRepository } from '../../db/config.repository';
import { AuditLogRepository } from '../../db/audit-log.repository';
import { SettingDefinitionService } from '../../services/setting-definition.service';
import { SettingValidator } from '../../services/setting-validator';
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
    const configRepo = new ConfigRepository(c.env);
    const definitionService = new SettingDefinitionService();
    const validator = new SettingValidator(definitionService);

    // Get all settings from database
    const rawSettings = await configRepo.getAllSettings();

    // Parse values according to their type definitions
    const settings: Record<string, SettingValue> = {};
    for (const [key, value] of Object.entries(rawSettings)) {
      settings[key] = validator.parseValue(key, value);
    }

    // Get all setting definitions
    const definitions = definitionService.getAllDefinitions();

    return c.json({
      settings,
      definitions,
    });
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

    const configRepo = new ConfigRepository(c.env);
    const auditRepo = new AuditLogRepository(c.env.DB);
    const definitionService = new SettingDefinitionService();
    const validator = new SettingValidator(definitionService);

    // Validate key
    if (!validator.isValidKey(key)) {
      return c.json(
        {
          success: false,
          message: `Unknown setting key: ${key}`,
        },
        400
      );
    }

    // Validate value
    if (!validator.isValidValue(key, value)) {
      return c.json(
        {
          success: false,
          message: `Invalid value for setting: ${key}`,
        },
        400
      );
    }

    // Get old value for audit log
    const oldValue = await configRepo.getSetting(key);

    // Normalize and save value
    const normalizedValue = validator.normalizeValue(key, value);
    await configRepo.updateSetting(key, normalizedValue);

    // Log the change
    const userSession = c.get('userSession') as UserSession;
    await auditRepo.logChange({
      userId: userSession.userId,
      action: oldValue ? 'update' : 'create',
      targetType: 'config',
      targetKey: key,
      oldValue: oldValue ?? undefined,
      newValue: normalizedValue,
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    return c.json({
      success: true,
      message: `Setting ${key} updated successfully`,
    });
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

    const configRepo = new ConfigRepository(c.env);
    const auditRepo = new AuditLogRepository(c.env.DB);
    const definitionService = new SettingDefinitionService();
    const validator = new SettingValidator(definitionService);

    const normalizedSettings: Record<string, string> = {};
    let updateCount = 0;

    // Validate all settings first
    for (const [key, value] of Object.entries(settings)) {
      if (!validator.isValidKey(key)) {
        return c.json(
          {
            success: false,
            message: `Unknown setting key: ${key}`,
            updated: 0,
          },
          400
        );
      }

      if (!validator.isValidValue(key, value)) {
        return c.json(
          {
            success: false,
            message: `Invalid value for setting: ${key}`,
            updated: 0,
          },
          400
        );
      }

      normalizedSettings[key] = validator.normalizeValue(key, value);
    }

    // Update all settings and create audit logs
    const userSession = c.get('userSession') as UserSession;
    for (const [key, normalizedValue] of Object.entries(normalizedSettings)) {
      const oldValue = await configRepo.getSetting(key);

      await configRepo.updateSetting(key, normalizedValue);
      updateCount++;

      // Log each change
      await auditRepo.logChange({
        userId: userSession.userId,
        action: oldValue ? 'update' : 'create',
        targetType: 'config',
        targetKey: key,
        oldValue: oldValue ?? undefined,
        newValue: normalizedValue,
        ipAddress: c.req.header('cf-connecting-ip'),
        userAgent: c.req.header('user-agent'),
      });
    }

    return c.json({
      success: true,
      message: `Successfully updated ${updateCount} settings`,
      updated: updateCount,
    });
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
