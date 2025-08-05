// Shared validation utilities for configuration values

export interface ValidationError {
  code: 'VALIDATION_ERROR';
  message: string;
  details: Record<string, string[]>;
}

export interface NormalizationResult {
  value: any;
  error?: ValidationError;
}

/**
 * Normalize and validate configuration values based on their type
 * @param type - Configuration type (string, boolean, number, json)
 * @param value - The value to normalize
 * @returns Normalized value or validation error
 */
export function normalizeConfigValue(type: string, value: any): NormalizationResult {
  // Convert string boolean values to actual booleans if type is boolean
  if (type === 'boolean' && typeof value === 'string') {
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === 'true') {
      return { value: true };
    } else if (lowerValue === 'false') {
      return { value: false };
    } else {
      return {
        value,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid configuration data',
          details: {
            value: ['Boolean value must be true, false, "true", or "false"']
          }
        }
      };
    }
  }

  // Additional type validation for JSON
  if (type === 'json' && typeof value === 'string') {
    try {
      // Try to parse to validate it's proper JSON
      const parsed = JSON.parse(value);
      // JSON type should be object or array, not primitive strings
      if (typeof parsed === 'string') {
        return {
          value,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid configuration data',
            details: {
              value: ['JSON type value must be an object or array, not a string']
            }
          }
        };
      }
      // Replace the string value with parsed object
      return { value: parsed };
    } catch {
      return {
        value,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid configuration data',
          details: {
            value: ['Value must be valid JSON for type "json"']
          }
        }
      };
    }
  }

  // Return value as-is for other types
  return { value };
}