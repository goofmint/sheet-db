/**
 * Settings Types
 * Defines types for system settings management
 */

/**
 * Supported setting value types
 */
export type SettingValue = string | number | boolean | string[];

/**
 * Validation rules for a setting
 */
export interface SettingValidation {
  /** Whether the setting is required */
  required?: boolean;
  /** Minimum value (for numbers) */
  min?: number;
  /** Maximum value (for numbers) */
  max?: number;
  /** Regex pattern (for strings) */
  pattern?: string;
  /** Allowed enum values */
  enum?: string[];
}

/**
 * Setting definition metadata
 * Defines how a setting should be displayed and validated
 */
export interface SettingDefinition {
  /** Unique key for the setting (e.g., 'maxFileSize') */
  key: string;
  /** Display label (e.g., 'Maximum File Size') */
  label: string;
  /** Description/help text for the setting */
  description: string;
  /** Category for grouping (e.g., 'file', 'cache', 'security') */
  category: string;
  /** Data type of the setting value */
  type: 'string' | 'number' | 'boolean' | 'array' | 'password';
  /** Default value for the setting */
  defaultValue: SettingValue;
  /** Validation rules */
  validation?: SettingValidation;
  /** Whether the setting contains sensitive data (passwords, keys) */
  sensitive?: boolean;
}
