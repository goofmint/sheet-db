import { BaseValidator } from './base-validator';
import type { ValidationResult, ValidationRule } from '../validation-types';

/**
 * String validator class
 * Handles validation for string type configuration values
 */
export class StringValidator extends BaseValidator {
  validate(value: string, rule: ValidationRule): ValidationResult {
    // Required check
    if (rule.required && this.isEmpty(value)) {
      return this.createError('This field is required');
    }
    
    // If empty and not required, it's valid
    if (this.isEmpty(value)) {
      return this.createSuccess();
    }
    
    // Length validation
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return this.createError(rule.errorMessage);
    }
    
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return this.createError(rule.errorMessage);
    }
    
    // Pattern validation
    if (rule.pattern) {
      try {
        const regex = new RegExp(rule.pattern);
        if (!regex.test(value)) {
          return this.createError(rule.errorMessage);
        }
      } catch (error) {
        // Invalid regex pattern - fallback to error
        return this.createError('Invalid validation pattern');
      }
    }
    
    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      return this.createError(rule.errorMessage);
    }
    
    return this.createSuccess();
  }
}