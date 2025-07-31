import { ValidatorFactory } from './validators/validator-factory';
import type { 
  ValidationResult, 
  ValidationResults, 
  ValidationRule, 
  ConfigWithValidation 
} from './validation-types';
import type { Config, ConfigType } from '../db/schema';
import { ConfigService } from '../services/config';

/**
 * Main configuration validator class
 * Provides database-driven validation for configuration values
 */
export class ConfigValidator {
  
  /**
   * Get validation rules dynamically from database
   * @returns Record of validation rules keyed by config key
   */
  private static async getValidationRules(): Promise<Record<string, ValidationRule>> {
    const configs = await this.getAllWithValidation();
    const rules: Record<string, ValidationRule> = {};
    
    for (const [key, config] of Object.entries(configs)) {
      if (config.validation) {
        rules[key] = config.validation;
      }
    }
    
    return rules;
  }

  /**
   * Get all configurations with validation rules
   * @returns Record of configurations with validation info
   */
  static async getAllWithValidation(): Promise<Record<string, ConfigWithValidation>> {
    // Get all configs from ConfigService cache
    const allConfigs = ConfigService.getAll();
    const result: Record<string, ConfigWithValidation> = {};
    
    // For each config, get the full database entry to access validation and system_config
    for (const key of Object.keys(allConfigs)) {
      const config = ConfigService.findByKey(key);
      if (config) {
        let validation: ValidationRule | null = null;
        if (config.validation) {
          try {
            validation = JSON.parse(config.validation);
          } catch (error) {
            console.warn(`Invalid validation JSON for key ${key}:`, error);
          }
        }
        
        result[key] = {
          key: config.key,
          value: config.value,
          type: config.type,
          description: config.description,
          validation,
          system_config: Boolean(config.system_config)
        };
      }
    }
    
    return result;
  }

  /**
   * Get single configuration with validation rule
   * @param key - The configuration key
   * @returns Configuration with validation info or null
   */
  static async getWithValidation(key: string): Promise<ConfigWithValidation | null> {
    const config = ConfigService.findByKey(key);
    if (!config) return null;
    
    let validation: ValidationRule | null = null;
    if (config.validation) {
      try {
        validation = JSON.parse(config.validation);
      } catch (error) {
        console.warn(`Invalid validation JSON for key ${key}:`, error);
      }
    }
    
    return {
      key: config.key,
      value: config.value,
      type: config.type,
      description: config.description,
      validation,
      system_config: Boolean(config.system_config)
    };
  }

  /**
   * Validate a single field asynchronously
   * @param key - The configuration key
   * @param value - The value to validate
   * @param allConfig - All configuration values for dependency validation
   * @returns Validation result
   */
  static async validateField(
    key: string, 
    value: string, 
    allConfig: Record<string, string>
  ): Promise<ValidationResult> {
    const rules = await this.getValidationRules();
    const rule = rules[key];
    
    if (!rule) {
      return { valid: true };
    }

    // Get type-specific validator
    const configType = rule.type || 'string';
    const validator = ValidatorFactory.getValidator(configType);
    
    // Use type-specific validator
    const result = validator.validate(value, rule);
    
    // If basic validation failed, return the error
    if (!result.valid) {
      return result;
    }

    // Additional dependency validation for this specific field
    const dependencyErrors = this.validateFieldDependencies(key, value, allConfig);
    if (dependencyErrors.length > 0) {
      return {
        valid: false,
        error: dependencyErrors[0] // Return first dependency error
      };
    }

    return { valid: true };
  }

  /**
   * Validate all configuration values asynchronously
   * @param config - Record of configuration key-value pairs
   * @returns Validation results for all configurations
   */
  static async validateAll(config: Record<string, string>): Promise<ValidationResults> {
    const rules = await this.getValidationRules();
    const results: ValidationResults = {
      valid: true,
      errors: {}
    };

    // Check all rules for existing values or missing required fields
    for (const ruleKey of Object.keys(rules)) {
      const value = config[ruleKey] || '';
      const result = await this.validateField(ruleKey, value, config);
      if (!result.valid) {
        results.valid = false;
        results.errors[ruleKey] = result.error!;
      }
    }

    // Validate additional config items (not defined in rules)
    for (const [key, value] of Object.entries(config)) {
      if (!rules[key]) {
        const result = await this.validateField(key, value, config);
        if (!result.valid) {
          results.valid = false;
          results.errors[key] = result.error!;
        }
      }
    }

    // Dependency validation
    const dependencyErrors = this.validateDependencies(config);
    if (Object.keys(dependencyErrors).length > 0) {
      results.valid = false;
      results.errors = { ...results.errors, ...dependencyErrors };
    }

    return results;
  }

  /**
   * Validate field-specific dependencies
   * @param key - The configuration key
   * @param value - The configuration value
   * @param config - All configuration values
   * @returns Array of dependency error messages
   */
  private static validateFieldDependencies(
    key: string, 
    value: string, 
    config: Record<string, string>
  ): string[] {
    const errors: string[] = [];
    
    // Storage type dependencies
    if (key === 'storage.r2.bucket' || key === 'storage.r2.access_key_id' || 
        key === 'storage.r2.secret_access_key' || key === 'storage.r2.endpoint') {
      if (config['storage.type'] !== 'r2' && value.trim() !== '') {
        errors.push('R2 configuration is only valid when storage type is r2');
      }
    }
    
    if (key === 'storage.gdrive.folder_id') {
      if (config['storage.type'] !== 'gdrive' && value.trim() !== '') {
        errors.push('Google Drive configuration is only valid when storage type is gdrive');
      }
    }
    
    return errors;
  }

  /**
   * Validate cross-field dependencies
   * @param config - All configuration values
   * @returns Record of dependency errors keyed by config key
   */
  private static validateDependencies(config: Record<string, string>): Record<string, string> {
    const errors: Record<string, string> = {};

    // Storage configuration dependencies
    const storageType = config['storage.type'];
    if (storageType === 'r2') {
      const requiredR2Fields = [
        'storage.r2.bucket',
        'storage.r2.access_key_id',
        'storage.r2.secret_access_key',
        'storage.r2.endpoint'
      ];
      
      for (const field of requiredR2Fields) {
        if (!config[field] || config[field].trim() === '') {
          errors[field] = `${field} is required when using R2 storage`;
        }
      }
    } else if (storageType === 'gdrive') {
      if (!config['storage.gdrive.folder_id'] || config['storage.gdrive.folder_id'].trim() === '') {
        errors['storage.gdrive.folder_id'] = 'Folder ID is required when using Google Drive storage';
      }
    }

    // Auth0 and Google mutual dependencies  
    const hasAuth0Config = config['auth0.domain'] && config['auth0.client_id'] && config['auth0.client_secret'];
    const hasGoogleConfig = config['google.client_id'] && config['google.client_secret'];

    if (!hasAuth0Config && !hasGoogleConfig) {
      errors['auth0.domain'] = 'Either Auth0 or Google configuration is required';
      errors['google.client_id'] = 'Either Auth0 or Google configuration is required';
    }

    return errors;
  }

  /**
   * Set validation rule for a configuration key (async)
   * @param key - The configuration key
   * @param validation - The validation rule
   */
  static async setValidation(key: string, validation: ValidationRule): Promise<void> {
    const config = ConfigService.findByKey(key);
    if (!config) {
      throw new Error(`Configuration key '${key}' not found`);
    }

    // Update the configuration with new validation rule
    await ConfigService.upsert(
      key, 
      config.value, 
      config.type as ConfigType, 
      config.description || undefined
    );
  }
}