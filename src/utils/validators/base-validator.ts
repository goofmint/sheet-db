import type { ValidationResult, ValidationRule } from '../validation-types';

/**
 * Base validator class
 * All type-specific validators should extend this class
 */
export abstract class BaseValidator {
  /**
   * Validate a value against a validation rule
   * @param value - The value to validate (always a string from forms)
   * @param rule - The validation rule to apply
   * @returns ValidationResult
   */
  abstract validate(value: string, rule: ValidationRule): ValidationResult;
  
  /**
   * Create an error result
   * @param message - The error message
   * @returns ValidationResult with valid: false
   */
  protected createError(message: string): ValidationResult {
    return { valid: false, error: message };
  }
  
  /**
   * Create a success result
   * @returns ValidationResult with valid: true
   */
  protected createSuccess(): ValidationResult {
    return { valid: true };
  }
  
  /**
   * Check if a value is empty
   * @param value - The value to check
   * @returns true if the value is empty or only whitespace
   */
  protected isEmpty(value: string): boolean {
    return !value || value.trim() === '';
  }
}