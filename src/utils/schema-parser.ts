/**
 * Schema parser for Google Sheets second row metadata
 */

export interface ColumnSchema {
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'pointer' | 'array' | 'object' | 'image';
  required?: boolean;
  unique?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  default?: any;
}

/**
 * Parse schema definition from a cell value
 * Supports both simple type strings and JSON metadata
 */
export function parseColumnSchema(cellValue: string): ColumnSchema {
  if (!cellValue || cellValue.trim() === '') {
    return { type: 'string' };
  }

  const trimmed = cellValue.trim();

  // Try to parse as JSON first
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      // Validate required type field
      if (!parsed.type) {
        console.warn(`Schema JSON missing 'type' field: ${trimmed}`);
        return { type: 'string' };
      }
      return parsed as ColumnSchema;
    } catch (e) {
      console.warn(`Failed to parse schema JSON: ${trimmed}`, e);
    }
  }

  // Fallback to simple type string
  const validTypes = ['string', 'number', 'boolean', 'datetime', 'pointer', 'array', 'object', 'image'];
  const lowerType = trimmed.toLowerCase();
  
  // Handle backward compatibility: map 'json' to 'object'
  const mappedType = lowerType === 'json' ? 'object' : lowerType;
  
  if (validTypes.includes(mappedType)) {
    return { type: mappedType as ColumnSchema['type'] };
  }

  // Default to string type
  console.warn(`Unknown type in schema: ${trimmed}, defaulting to string`);
  return { type: 'string' };
}

/**
 * Validate a value against a column schema
 */
export function validateValue(value: any, schema: ColumnSchema): { valid: boolean; error?: string } {
  // Handle required check
  if (schema.required && (value === null || value === undefined || value === '')) {
    return { valid: false, error: 'Value is required' };
  }

  // If value is empty and not required, it's valid
  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  // Type validation
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: `Expected string, got ${typeof value}` };
      }
      
      // Pattern validation
      if (schema.pattern) {
        try {
          const regex = new RegExp(schema.pattern);
          if (!regex.test(value)) {
            return { valid: false, error: `Value does not match pattern: ${schema.pattern}` };
          }
        } catch (e) {
          console.error(`Invalid regex pattern: ${schema.pattern}`, e);
        }
      }
      
      // Length validation
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return { valid: false, error: `String length must be at least ${schema.minLength}` };
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return { valid: false, error: `String length must not exceed ${schema.maxLength}` };
      }
      break;

    case 'number':
      const num = Number(value);
      if (isNaN(num)) {
        return { valid: false, error: 'Value must be a number' };
      }
      
      // Range validation
      if (schema.min !== undefined && num < schema.min) {
        return { valid: false, error: `Value must be at least ${schema.min}` };
      }
      if (schema.max !== undefined && num > schema.max) {
        return { valid: false, error: `Value must not exceed ${schema.max}` };
      }
      break;

    case 'boolean':
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower !== 'true' && lower !== 'false') {
          return { valid: false, error: 'Value must be true or false' };
        }
      } else if (typeof value !== 'boolean') {
        return { valid: false, error: 'Value must be a boolean' };
      }
      break;

    case 'datetime':
      if (typeof value !== 'string' || isNaN(Date.parse(value))) {
        return { valid: false, error: 'Value must be a valid datetime string' };
      }
      break;

    case 'object':
      if (typeof value === 'string') {
        try {
          JSON.parse(value);
        } catch (e) {
          return { valid: false, error: 'Value must be valid JSON' };
        }
      }
      break;

    case 'pointer':
      // Pointer type validation - should be a string representing an ID reference
      if (typeof value !== 'string') {
        return { valid: false, error: 'Pointer value must be a string' };
      }
      break;

    case 'array':
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            return { valid: false, error: 'Value must be a JSON array' };
          }
        } catch (e) {
          return { valid: false, error: 'Value must be a valid JSON array' };
        }
      } else if (!Array.isArray(value)) {
        return { valid: false, error: 'Value must be an array' };
      }
      break;

    case 'image':
      if (typeof value !== 'string') {
        return { valid: false, error: 'Image value must be a string' };
      }
      
      // Validate image data URL or URL
      if (value.startsWith('data:image/')) {
        // Validate data URL format with support for modern formats
        const imageDataUrlRegex = /^data:image\/(png|jpg|jpeg|gif|webp|avif|webp2|svg\+xml);base64,([A-Za-z0-9+/=]+)$/;
        if (!imageDataUrlRegex.test(value)) {
          return { valid: false, error: 'Invalid image data URL format' };
        }
        
        // Security warning for SVG files due to potential embedded scripts
        if (value.includes('svg+xml')) {
          console.warn('Security Notice: SVG images can contain embedded scripts. Ensure proper sanitization before use.');
        }
        
        // Check size (approximate)
        const base64Data = value.split(',')[1];
        const imageSize = (base64Data.length * 3) / 4;
        const maxImageSize = 5 * 1024 * 1024; // 5MB
        
        if (imageSize > maxImageSize) {
          return { valid: false, error: `Image size exceeds limit of ${maxImageSize} bytes` };
        }
      } else if (value.startsWith('http://') || value.startsWith('https://')) {
        // Validate URL format
        try {
          const url = new URL(value);
          
          // Enhanced validation: Check if URL likely points to an image
          const pathname = url.pathname.toLowerCase();
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.webp2', '.svg', '.bmp', '.tiff', '.ico'];
          const hasImageExtension = imageExtensions.some(ext => pathname.endsWith(ext));
          
          // Check for common image URL patterns or extensions
          if (!hasImageExtension && !pathname.includes('/image') && !url.searchParams.has('format')) {
            console.warn(`URL validation notice: "${value}" does not appear to point to an image resource based on file extension or URL pattern.`);
          }
          
        } catch (e) {
          return { valid: false, error: 'Invalid image URL' };
        }
      } else {
        return { valid: false, error: 'Image value must be a data URL or HTTP(S) URL' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Example schema definitions for common use cases
 */
export const SCHEMA_EXAMPLES = {
  // Simple types
  string: { type: 'string' },
  number: { type: 'number' },
  boolean: { type: 'boolean' },
  datetime: { type: 'datetime' },
  object: { type: 'object' },
  pointer: { type: 'pointer' },
  array: { type: 'array' },
  image: { type: 'image' },
  
  // Required fields
  requiredString: { type: 'string', required: true },
  requiredEmail: { type: 'string', required: true, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
  
  // Unique fields
  uniqueId: { type: 'string', required: true, unique: true },
  uniqueEmail: { type: 'string', required: true, unique: true, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
  
  // Pattern matching
  alphanumeric: { type: 'string', pattern: '^[a-zA-Z0-9]+$' },
  phoneNumber: { type: 'string', pattern: '^\\+?[1-9]\\d{1,14}$' },
  
  // Length constraints
  username: { type: 'string', required: true, minLength: 3, maxLength: 20, pattern: '^[a-zA-Z0-9_]+$' },
  password: { type: 'string', required: true, minLength: 8 },
  
  // Number constraints
  age: { type: 'number', min: 0, max: 150 },
  percentage: { type: 'number', min: 0, max: 100 },
  
  // Arrays
  tags: { type: 'array' },
  roles: { type: 'array', required: true },
  
  // Images
  profilePicture: { type: 'image' },
  requiredAvatar: { type: 'image', required: true },
};