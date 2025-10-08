/**
 * Settings Service
 * Handles system settings management logic
 */

import type { Env } from '../types/env';
import { ConfigRepository } from '../db/config.repository';
import { AuditLogRepository } from '../db/audit-log.repository';
import { SettingDefinitionService } from './setting-definition.service';
import { SettingValidator } from './setting-validator';
import type { SettingValue, SettingDefinition } from '../types/settings';

export interface GetSettingsResult {
  settings: Record<string, SettingValue | null>;
  definitions: SettingDefinition[];
}

export interface UpdateSettingRequest {
  key: string;
  value: SettingValue;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateSettingResult {
  success: boolean;
  message: string;
}

export interface BulkUpdateRequest {
  settings: Record<string, SettingValue>;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface BulkUpdateResult {
  success: boolean;
  message: string;
  updated: number;
}

export class SettingsService {
  private configRepo: ConfigRepository;
  private auditRepo: AuditLogRepository;
  private definitionService: SettingDefinitionService;
  private validator: SettingValidator;

  constructor(env: Env) {
    this.configRepo = new ConfigRepository(env);
    this.auditRepo = new AuditLogRepository(env.DB);
    this.definitionService = new SettingDefinitionService();
    this.validator = new SettingValidator(this.definitionService);
  }

  /**
   * Get all settings with their definitions
   */
  async getAllSettings(): Promise<GetSettingsResult> {
    // Get all settings from database
    const rawSettings = await this.configRepo.getAllSettings();

    // Parse values according to their type definitions, hiding any sensitive entries
    const settings: Record<string, SettingValue | null> = {};
    for (const definition of this.definitionService.getAllDefinitions()) {
      const storedValue = rawSettings[definition.key];

      // If nothing is stored yet, fall back to default (or null for sensitive)
      if (storedValue === undefined) {
        settings[definition.key] = definition.sensitive
          ? null
          : definition.defaultValue;
        continue;
      }

      // Mask any sensitive setting
      if (definition.sensitive) {
        settings[definition.key] = null;
        continue;
      }

      // Otherwise parse normally
      settings[definition.key] = this.validator.parseValue(
        definition.key,
        storedValue
      );
    }

    // Get all setting definitions
    const definitions = this.definitionService.getAllDefinitions();

    return {
      settings,
      definitions,
    };
  }

  /**
   * Update a single setting value
   */
  async updateSetting(
    request: UpdateSettingRequest
  ): Promise<UpdateSettingResult> {
    const { key, value, userId, ipAddress, userAgent } = request;

    // Validate key
    if (!this.validator.isValidKey(key)) {
      return {
        success: false,
        message: `Unknown setting key: ${key}`,
      };
    }

    // Validate value
    if (!this.validator.isValidValue(key, value)) {
      return {
        success: false,
        message: `Invalid value for setting: ${key}`,
      };
    }

    // Get old value for audit log
    const definition = this.definitionService.getDefinition(key);
    const isSensitive = definition?.sensitive === true;
    const oldValue = await this.configRepo.getSetting(key);

    // Normalize and save value
    const normalizedValue = this.validator.normalizeValue(key, value);
    if (isSensitive) {
      await this.configRepo.setEncrypted(key, normalizedValue);
    } else {
      await this.configRepo.updateSetting(key, normalizedValue);
    }

    // Log the change
    await this.auditRepo.logChange({
      userId,
      action: oldValue ? 'update' : 'create',
      targetType: 'config',
      targetKey: key,
      oldValue: isSensitive ? undefined : oldValue ?? undefined,
      newValue: isSensitive ? '[REDACTED]' : normalizedValue,
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      message: `Setting ${key} updated successfully`,
    };
  }

  /**
   * Update multiple settings at once
   */
  async bulkUpdateSettings(
    request: BulkUpdateRequest
  ): Promise<BulkUpdateResult> {
    const { settings, userId, ipAddress, userAgent } = request;

    const normalizedSettings: Record<string, string> = {};
    let updateCount = 0;

    // Validate all settings first
    for (const [key, value] of Object.entries(settings)) {
      if (!this.validator.isValidKey(key)) {
        return {
          success: false,
          message: `Unknown setting key: ${key}`,
          updated: 0,
        };
      }

      if (!this.validator.isValidValue(key, value)) {
        return {
          success: false,
          message: `Invalid value for setting: ${key}`,
          updated: 0,
        };
      }

      normalizedSettings[key] = this.validator.normalizeValue(key, value);
    }

    // Update all settings and create audit logs
    for (const [key, normalizedValue] of Object.entries(normalizedSettings)) {
      const definition = this.definitionService.getDefinition(key);
      const isSensitive = definition?.sensitive === true;
      const oldValue = await this.configRepo.getSetting(key);

      if (isSensitive) {
        await this.configRepo.setEncrypted(key, normalizedValue);
      } else {
        await this.configRepo.updateSetting(key, normalizedValue);
      }
      updateCount++;

      // Log each change
      await this.auditRepo.logChange({
        userId,
        action: oldValue ? 'update' : 'create',
        targetType: 'config',
        targetKey: key,
        oldValue: isSensitive ? undefined : oldValue ?? undefined,
        newValue: isSensitive ? '[REDACTED]' : normalizedValue,
        ipAddress,
        userAgent,
      });
    }

    return {
      success: true,
      message: `Successfully updated ${updateCount} settings`,
      updated: updateCount,
    };
  }
}
