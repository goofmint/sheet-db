import { BaseValidator } from './base-validator';
import type { ValidationResult, ValidationRule } from '../validation-types';

/**
 * Boolean validator class
 * Handles validation for boolean type configuration values
 */
export class BooleanValidator extends BaseValidator {
  validate(value: string, rule: ValidationRule): ValidationResult {
    // Required check
    if (rule.required && this.isEmpty(value)) {
      return this.createError('This field is required');
    }
    
    // If empty and not required, it's valid
    if (this.isEmpty(value)) {
      return this.createSuccess();
    }
    
    // Boolean validation - must be 'true' or 'false'
    if (value !== 'true' && value !== 'false') {
      return this.createError(rule.errorMessage || 'Must be true or false');
    }
    
    return this.createSuccess();
  }
}