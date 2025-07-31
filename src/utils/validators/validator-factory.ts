import { BaseValidator } from './base-validator';
import { StringValidator } from './string-validator';
import { NumberValidator } from './number-validator';
import { BooleanValidator } from './boolean-validator';

/**
 * Validator factory class
 * Manages type-specific validator instances and provides validator selection
 */
export class ValidatorFactory {
  private static validators: Map<string, BaseValidator> = new Map([
    ['string', new StringValidator()],
    ['number', new NumberValidator()],
    ['boolean', new BooleanValidator()]
  ]);
  
  /**
   * Get validator for a specific type
   * @param type - The validation type
   * @returns The appropriate validator instance
   */
  static getValidator(type: string): BaseValidator {
    const validator = this.validators.get(type);
    if (!validator) {
      // Default to string validator for unknown types
      return this.validators.get('string')!;
    }
    return validator;
  }
  
  /**
   * Register a new validator for a specific type
   * @param type - The type to register the validator for
   * @param validator - The validator instance
   */
  static registerValidator(type: string, validator: BaseValidator): void {
    this.validators.set(type, validator);
  }
  
  /**
   * Get all registered validator types
   * @returns Array of registered types
   */
  static getRegisteredTypes(): string[] {
    return Array.from(this.validators.keys());
  }
  
  /**
   * Check if a validator type is registered
   * @param type - The type to check
   * @returns true if the type is registered
   */
  static isValidatorRegistered(type: string): boolean {
    return this.validators.has(type);
  }
}