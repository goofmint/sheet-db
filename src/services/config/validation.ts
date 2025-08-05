import type { ConfigType } from '../../db/schema';
import type { ConfigUpdatePayload } from './types';

/**
 * Configuration validation utilities
 */
export class ConfigValidator {
  /**
   * Validate config update payload structure
   */
  static validateUpdatePayload(configs: unknown): asserts configs is ConfigUpdatePayload {
    if (!configs || typeof configs !== 'object') {
      throw new Error('Configs must be a non-empty object');
    }

    const configsObj = configs as Record<string, unknown>;
    const entries = Object.entries(configsObj);
    
    if (entries.length === 0) {
      throw new Error('Configs object cannot be empty');
    }

    for (const [key, config] of entries) {
      if (!key || typeof key !== 'string' || key.trim() === '') {
        throw new Error('Config keys must be non-empty strings');
      }

      if (!config || typeof config !== 'object') {
        throw new Error(`Config for key "${key}" must be an object`);
      }

      const configObj = config as Record<string, unknown>;
      
      if (typeof configObj.value !== 'string') {
        throw new Error(`Config value for key "${key}" must be a string`);
      }

      if (configObj.type !== undefined) {
        const validTypes: ConfigType[] = ['string', 'number', 'boolean', 'json'];
        if (!validTypes.includes(configObj.type as ConfigType)) {
          throw new Error(`Config type for key "${key}" must be one of: ${validTypes.join(', ')}`);
        }
      }
    }
  }

  /**
   * Validate a single config key
   */
  static validateKey(key: string): void {
    if (!key || typeof key !== 'string' || key.trim() === '') {
      throw new Error('Config key must be a non-empty string');
    }
  }

  /**
   * Validate a config value
   */
  static validateValue(value: string, type: ConfigType = 'string'): void {
    if (typeof value !== 'string') {
      throw new Error('Config value must be a string');
    }

    switch (type) {
      case 'number':
        if (isNaN(Number(value))) {
          throw new Error(`Value must be a number for type "number"`);
        }
        break;
      case 'boolean':
        if (!['true', 'false'].includes(value.toLowerCase())) {
          throw new Error(`Value must be a boolean for type "boolean"`);
        }
        break;
      case 'json':
        try {
          JSON.parse(value);
        } catch {
          throw new Error(`Value must be a valid JSON object or array for type "json"`);
        }
        break;
      // 'string' type requires no additional validation
    }
  }
}