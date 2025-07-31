import { BaseValidator } from './base-validator';
import type { ValidationResult, ValidationRule } from '../validation-types';

/**
 * Number validator class
 * Handles validation for number type configuration values
 */
export class NumberValidator extends BaseValidator {
  validate(value: string, rule: ValidationRule): ValidationResult {
    // Required check
    if (rule.required && this.isEmpty(value)) {
      return this.createError('This field is required');
    }
    
    // If empty and not required, it's valid
    if (this.isEmpty(value)) {
      return this.createSuccess();
    }
    
    // Type validation - check if it's a valid number
    const numValue = parseFloat(value);
    if (isNaN(numValue) || !isFinite(numValue)) {
      return this.createError(rule.errorMessage || 'Must be a valid number');
    }
    
    // Range validation
    if (rule.min !== undefined && numValue < rule.min) {
      return this.createError(rule.errorMessage);
    }
    
    if (rule.max !== undefined && numValue > rule.max) {
      return this.createError(rule.errorMessage);
    }
    
    return this.createSuccess();
  }
}