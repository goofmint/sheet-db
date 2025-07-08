import { describe, it, expect } from 'vitest';
import { parseColumnSchema, validateValue } from '../src/utils/schema-parser';

describe('Schema Validation', () => {
  it('should parse simple type strings', () => {
    const schema = parseColumnSchema('string');
    expect(schema).toEqual({ type: 'string' });
  });

  it('should parse JSON schema with required field', () => {
    const jsonSchema = '{"type":"string","required":true}';
    const schema = parseColumnSchema(jsonSchema);
    expect(schema).toEqual({ type: 'string', required: true });
  });

  it('should parse JSON schema with unique constraint', () => {
    const jsonSchema = '{"type":"string","required":true,"unique":true}';
    const schema = parseColumnSchema(jsonSchema);
    expect(schema).toEqual({ type: 'string', required: true, unique: true });
  });

  it('should parse JSON schema with pattern validation', () => {
    const jsonSchema = '{"type":"string","pattern":"^[a-zA-Z0-9]+$"}';
    const schema = parseColumnSchema(jsonSchema);
    expect(schema).toEqual({ type: 'string', pattern: '^[a-zA-Z0-9]+$' });
  });

  it('should validate required field', () => {
    const schema = { type: 'string' as const, required: true };
    
    // Valid case
    const validResult = validateValue('test', schema);
    expect(validResult.valid).toBe(true);
    
    // Invalid case - empty value
    const invalidResult = validateValue('', schema);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.error).toBe('Value is required');
  });

  it('should validate email pattern', () => {
    const schema = { 
      type: 'string' as const, 
      pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' 
    };
    
    // Valid email
    const validResult = validateValue('test@example.com', schema);
    expect(validResult.valid).toBe(true);
    
    // Invalid email
    const invalidResult = validateValue('invalid-email', schema);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.error).toContain('does not match pattern');
  });

  it('should validate number type', () => {
    const schema = { type: 'number' as const };
    
    // Valid number
    const validResult = validateValue('123', schema);
    expect(validResult.valid).toBe(true);
    
    // Invalid number
    const invalidResult = validateValue('not-a-number', schema);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.error).toBe('Value must be a number');
  });

  it('should validate array type', () => {
    const schema = { type: 'array' as const };
    
    // Valid JSON array
    const validResult = validateValue('["item1", "item2"]', schema);
    expect(validResult.valid).toBe(true);
    
    // Invalid JSON
    const invalidResult = validateValue('not-json', schema);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.error).toBe('Value must be a valid JSON array');
  });

  it('should validate boolean type', () => {
    const schema = { type: 'boolean' as const };
    
    // Valid boolean string
    const validResult = validateValue('true', schema);
    expect(validResult.valid).toBe(true);
    
    // Invalid boolean
    const invalidResult = validateValue('maybe', schema);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.error).toBe('Value must be true or false');
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined inputs for string type', () => {
      const schema = { type: 'string' as const };
      
      // Test null
      const nullResult = validateValue(null as any, schema);
      expect(nullResult.valid).toBe(false);
      expect(nullResult.error).toBe('Value must be a string');
      
      // Test undefined
      const undefinedResult = validateValue(undefined as any, schema);
      expect(undefinedResult.valid).toBe(false);
      expect(undefinedResult.error).toBe('Value must be a string');
      
      // Test null with required
      const requiredSchema = { type: 'string' as const, required: true };
      const nullRequiredResult = validateValue(null as any, requiredSchema);
      expect(nullRequiredResult.valid).toBe(false);
      expect(nullRequiredResult.error).toBe('Value is required');
    });

    it('should handle numeric strings with leading zeros for number type', () => {
      const schema = { type: 'number' as const };
      
      // Test with leading zeros
      const leadingZeroResult = validateValue('007', schema);
      expect(leadingZeroResult.valid).toBe(true);
      
      // Test with multiple leading zeros
      const multipleZerosResult = validateValue('000123', schema);
      expect(multipleZerosResult.valid).toBe(true);
      
      // Test zero alone
      const zeroResult = validateValue('0', schema);
      expect(zeroResult.valid).toBe(true);
      
      // Test negative with leading zeros
      const negativeWithZerosResult = validateValue('-00123', schema);
      expect(negativeWithZerosResult.valid).toBe(true);
    });

    it('should handle complex nested JSON arrays for array type', () => {
      const schema = { type: 'array' as const };
      
      // Test nested arrays
      const nestedArrayResult = validateValue('[["a", "b"], ["c", "d"]]', schema);
      expect(nestedArrayResult.valid).toBe(true);
      
      // Test mixed types in array
      const mixedTypesResult = validateValue('[1, "string", true, null, {"key": "value"}]', schema);
      expect(mixedTypesResult.valid).toBe(true);
      
      // Test deeply nested structure
      const deeplyNestedResult = validateValue('[{"users": [{"name": "John", "roles": ["admin", "user"]}]}]', schema);
      expect(deeplyNestedResult.valid).toBe(true);
      
      // Test empty array
      const emptyArrayResult = validateValue('[]', schema);
      expect(emptyArrayResult.valid).toBe(true);
      
      // Test array with special characters
      const specialCharsResult = validateValue('["special\\nchars", "with\\"quotes"]', schema);
      expect(specialCharsResult.valid).toBe(true);
    });
  });
});