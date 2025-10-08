/**
 * Setting Validator
 * Validates setting values based on their definitions
 * Provides type checking and validation rule enforcement
 */

import type { SettingValue, SettingValidation } from '../types/settings';
import { SettingDefinitionService } from './setting-definition.service';

/**
 * Service for validating setting values against their definitions
 */
export class SettingValidator {
  constructor(private definitionService: SettingDefinitionService) {}

  /**
   * Check if a setting key is valid (exists in definitions)
   * @param key - Setting key to validate
   * @returns True if the key exists in definitions
   */
  isValidKey(key: string): boolean {
    return this.definitionService.getDefinition(key) !== null;
  }

  /**
   * Validate a setting value against its definition
   * Checks type compatibility and validation rules
   *
   * @param key - Setting key
   * @param value - Value to validate
   * @returns True if valid, false otherwise
   */
  isValidValue(key: string, value: unknown): boolean {
    const definition = this.definitionService.getDefinition(key);
    if (!definition) {
      return false;
    }

    // Type check
    if (!this.checkType(value, definition.type)) {
      return false;
    }

    // Validation rules check
    if (definition.validation) {
      return this.validateAgainstRules(value, definition.validation);
    }

    return true;
  }

  /**
   * Normalize a value to string for database storage
   * All values are stored as strings in the config table
   *
   * @param key - Setting key
   * @param value - Value to normalize
   * @returns Normalized string value
   * @throws Error if value is invalid
   */
  normalizeValue(key: string, value: unknown): string {
    const definition = this.definitionService.getDefinition(key);
    if (!definition) {
      throw new Error(`Unknown setting key: ${key}`);
    }

    if (!this.isValidValue(key, value)) {
      throw new Error(`Invalid value for setting key: ${key}`);
    }

    // Convert to string for database storage
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    return String(value);
  }

  /**
   * Parse a stored string value back to its proper type
   *
   * @param key - Setting key
   * @param storedValue - String value from database
   * @returns Parsed value in the correct type
   */
  parseValue(key: string, storedValue: string): SettingValue {
    const definition = this.definitionService.getDefinition(key);
    if (!definition) {
      return storedValue;
    }

    switch (definition.type) {
      case 'number':
        return Number(storedValue);

      case 'boolean':
        return storedValue === 'true';

      case 'array':
        try {
          const parsed = JSON.parse(storedValue);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }

      case 'string':
      case 'password':
      default:
        return storedValue;
    }
  }

  /**
   * Check if a value matches the expected type
   * @private
   */
  private checkType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
      case 'password':
        return typeof value === 'string';

      case 'number':
        return typeof value === 'number' && !isNaN(value);

      case 'boolean':
        return typeof value === 'boolean';

      case 'array':
        return Array.isArray(value);

      default:
        return false;
    }
  }

  /**
   * Validate value against validation rules
   * @private
   */
  private validateAgainstRules(value: unknown, rules: SettingValidation): boolean {
    // Required check
    if (rules.required) {
      if (value === null || value === undefined || value === '') {
        return false;
      }
    }

    // Number validation
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        return false;
      }
      if (rules.max !== undefined && value > rules.max) {
        return false;
      }
    }

    // String validation
    if (typeof value === 'string') {
      // Pattern validation
      if (rules.pattern) {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(value)) {
          return false;
        }
      }

      // Enum validation
      if (rules.enum && rules.enum.length > 0) {
        if (!rules.enum.includes(value)) {
          return false;
        }
      }
    }

    return true;
  }
}
