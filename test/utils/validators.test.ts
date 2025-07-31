import { describe, it, expect } from 'vitest';
import { StringValidator } from '../../src/utils/validators/string-validator';
import { NumberValidator } from '../../src/utils/validators/number-validator';
import { BooleanValidator } from '../../src/utils/validators/boolean-validator';
import { ValidatorFactory } from '../../src/utils/validators/validator-factory';
import type { ValidationRule } from '../../src/utils/validation-types';

describe('Validators', () => {
  describe('StringValidator', () => {
    const validator = new StringValidator();

    it('should validate required string fields', () => {
      const rule: ValidationRule = {
        required: true,
        errorMessage: 'This field is required'
      };

      expect(validator.validate('valid-string', rule)).toEqual({ valid: true });
      expect(validator.validate('', rule)).toEqual({ 
        valid: false, 
        error: 'This field is required' 
      });
      expect(validator.validate('   ', rule)).toEqual({ 
        valid: false, 
        error: 'This field is required' 
      });
    });

    it('should validate string length', () => {
      const rule: ValidationRule = {
        minLength: 5,
        maxLength: 10,
        errorMessage: 'String length must be between 5 and 10 characters'
      };

      expect(validator.validate('12345', rule)).toEqual({ valid: true });
      expect(validator.validate('1234567890', rule)).toEqual({ valid: true });
      expect(validator.validate('1234', rule)).toEqual({ 
        valid: false, 
        error: 'String length must be between 5 and 10 characters' 
      });
      expect(validator.validate('12345678901', rule)).toEqual({ 
        valid: false, 
        error: 'String length must be between 5 and 10 characters' 
      });
    });

    it('should validate pattern matching', () => {
      const rule: ValidationRule = {
        pattern: '^[a-zA-Z0-9]+$',
        errorMessage: 'Only alphanumeric characters allowed'
      };

      expect(validator.validate('abc123', rule)).toEqual({ valid: true });
      expect(validator.validate('abc-123', rule)).toEqual({ 
        valid: false, 
        error: 'Only alphanumeric characters allowed' 
      });
    });

    it('should validate enum values', () => {
      const rule: ValidationRule = {
        enum: ['r2', 'gdrive'],
        errorMessage: 'Must be either r2 or gdrive'
      };

      expect(validator.validate('r2', rule)).toEqual({ valid: true });
      expect(validator.validate('gdrive', rule)).toEqual({ valid: true });
      expect(validator.validate('s3', rule)).toEqual({ 
        valid: false, 
        error: 'Must be either r2 or gdrive' 
      });
    });

    it('should skip validation for empty non-required fields', () => {
      const rule: ValidationRule = {
        required: false,
        minLength: 5,
        errorMessage: 'Must be at least 5 characters'
      };

      expect(validator.validate('', rule)).toEqual({ valid: true });
      expect(validator.validate('   ', rule)).toEqual({ valid: true });
    });

    it('should handle invalid regex pattern gracefully', () => {
      const rule: ValidationRule = {
        pattern: '[invalid-regex',
        errorMessage: 'Invalid pattern'
      };

      const result = validator.validate('test', rule);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid validation pattern');
    });
  });

  describe('NumberValidator', () => {
    const validator = new NumberValidator();

    it('should validate number values', () => {
      const rule: ValidationRule = {
        required: true,
        errorMessage: 'Must be a valid number'
      };

      expect(validator.validate('123', rule)).toEqual({ valid: true });
      expect(validator.validate('123.45', rule)).toEqual({ valid: true });
      expect(validator.validate('-123', rule)).toEqual({ valid: true });
      expect(validator.validate('0', rule)).toEqual({ valid: true });
      
      expect(validator.validate('abc', rule)).toEqual({ 
        valid: false, 
        error: 'Must be a valid number' 
      });
      expect(validator.validate('123abc', rule)).toEqual({ 
        valid: false, 
        error: 'Must be a valid number' 
      });
    });

    it('should validate number ranges', () => {
      const rule: ValidationRule = {
        min: 1,
        max: 100,
        errorMessage: 'Must be between 1 and 100'
      };

      expect(validator.validate('50', rule)).toEqual({ valid: true });
      expect(validator.validate('1', rule)).toEqual({ valid: true });
      expect(validator.validate('100', rule)).toEqual({ valid: true });
      
      expect(validator.validate('0', rule)).toEqual({ 
        valid: false, 
        error: 'Must be between 1 and 100' 
      });
      expect(validator.validate('101', rule)).toEqual({ 
        valid: false, 
        error: 'Must be between 1 and 100' 
      });
    });

    it('should skip validation for empty non-required fields', () => {
      const rule: ValidationRule = {
        required: false,
        min: 1,
        errorMessage: 'Must be at least 1'
      };

      expect(validator.validate('', rule)).toEqual({ valid: true });
    });

    it('should handle special number values', () => {
      const rule: ValidationRule = {
        required: true,
        errorMessage: 'Must be a valid number'
      };

      expect(validator.validate('Infinity', rule)).toEqual({ 
        valid: false, 
        error: 'Must be a valid number' 
      });
      expect(validator.validate('NaN', rule)).toEqual({ 
        valid: false, 
        error: 'Must be a valid number' 
      });
    });
  });

  describe('BooleanValidator', () => {
    const validator = new BooleanValidator();

    it('should validate boolean values', () => {
      const rule: ValidationRule = {
        required: true,
        errorMessage: 'Must be true or false'
      };

      expect(validator.validate('true', rule)).toEqual({ valid: true });
      expect(validator.validate('false', rule)).toEqual({ valid: true });
      
      expect(validator.validate('yes', rule)).toEqual({ 
        valid: false, 
        error: 'Must be true or false' 
      });
      expect(validator.validate('1', rule)).toEqual({ 
        valid: false, 
        error: 'Must be true or false' 
      });
      expect(validator.validate('True', rule)).toEqual({ 
        valid: false, 
        error: 'Must be true or false' 
      });
    });

    it('should skip validation for empty non-required fields', () => {
      const rule: ValidationRule = {
        required: false,
        errorMessage: 'Must be true or false'
      };

      expect(validator.validate('', rule)).toEqual({ valid: true });
    });
  });

  describe('ValidatorFactory', () => {
    it('should return correct validator for each type', () => {
      expect(ValidatorFactory.getValidator('string')).toBeInstanceOf(StringValidator);
      expect(ValidatorFactory.getValidator('number')).toBeInstanceOf(NumberValidator);
      expect(ValidatorFactory.getValidator('boolean')).toBeInstanceOf(BooleanValidator);
    });

    it('should return string validator for unknown types', () => {
      expect(ValidatorFactory.getValidator('unknown')).toBeInstanceOf(StringValidator);
    });

    it('should allow registering custom validators', () => {
      class CustomValidator extends StringValidator {}
      const customValidator = new CustomValidator();
      
      ValidatorFactory.registerValidator('custom', customValidator);
      
      expect(ValidatorFactory.getValidator('custom')).toBe(customValidator);
    });

    it('should provide utility methods', () => {
      expect(ValidatorFactory.getRegisteredTypes()).toContain('string');
      expect(ValidatorFactory.getRegisteredTypes()).toContain('number');
      expect(ValidatorFactory.getRegisteredTypes()).toContain('boolean');
      
      expect(ValidatorFactory.isValidatorRegistered('string')).toBe(true);
      expect(ValidatorFactory.isValidatorRegistered('nonexistent')).toBe(false);
    });
  });
});