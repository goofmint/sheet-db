import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigValidator } from '../../src/utils/config-validator';
import { ConfigService } from '../../src/services/config';

// Mock ConfigService
vi.mock('../../src/services/config', () => ({
  ConfigService: {
    getAllWithValidation: vi.fn(),
    findByKey: vi.fn(),
  }
}));

describe('ConfigValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateField', () => {
    it('should validate required field successfully', async () => {
      // Mock validation rules
      vi.mocked(ConfigService.getAllWithValidation).mockResolvedValue({
        'test.key': {
          key: 'test.key',
          value: 'test-value',
          type: 'string',
          description: 'Test field',
          validation: {
            required: true,
            errorMessage: 'This field is required'
          },
          system_config: false
        }
      });

      const result = await ConfigValidator.validateField('test.key', 'valid-value', {});
      
      expect(result.valid).toBe(true);
    });

    it('should fail validation for required field with empty value', async () => {
      vi.mocked(ConfigService.getAllWithValidation).mockResolvedValue({
        'test.key': {
          key: 'test.key',
          value: '',
          type: 'string',
          description: 'Test field',
          validation: {
            required: true,
            errorMessage: 'This field is required'
          },
          system_config: false
        }
      });

      const result = await ConfigValidator.validateField('test.key', '', {});
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('This field is required');
    });

    it('should validate pattern matching', async () => {
      vi.mocked(ConfigService.getAllWithValidation).mockResolvedValue({
        'google.client_id': {
          key: 'google.client_id',
          value: '12345-abcdef.apps.googleusercontent.com',
          type: 'string',
          description: 'Google Client ID',
          validation: {
            required: true,
            pattern: '^[0-9]+-[a-zA-Z0-9]+\\.apps\\.googleusercontent\\.com$',
            errorMessage: 'Invalid Google Client ID format'
          },
          system_config: true
        }
      });

      const validResult = await ConfigValidator.validateField(
        'google.client_id', 
        '12345-abcdef.apps.googleusercontent.com', 
        {}
      );
      expect(validResult.valid).toBe(true);

      const invalidResult = await ConfigValidator.validateField(
        'google.client_id', 
        'invalid-format', 
        {}
      );
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Invalid Google Client ID format');
    });

    it('should validate number type', async () => {
      vi.mocked(ConfigService.getAllWithValidation).mockResolvedValue({
        'cache.ttl_minutes': {
          key: 'cache.ttl_minutes',
          value: '60',
          type: 'number',
          description: 'Cache TTL in minutes',
          validation: {
            required: true,
            type: 'number',
            min: 1,
            max: 1440,
            errorMessage: 'Cache TTL must be between 1 and 1440 minutes'
          },
          system_config: true
        }
      });

      const validResult = await ConfigValidator.validateField(
        'cache.ttl_minutes', 
        '60', 
        {}
      );
      expect(validResult.valid).toBe(true);

      const invalidResult = await ConfigValidator.validateField(
        'cache.ttl_minutes', 
        'invalid-number', 
        {}
      );
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Cache TTL must be between 1 and 1440 minutes');
    });

    it('should validate boolean type', async () => {
      vi.mocked(ConfigService.getAllWithValidation).mockResolvedValue({
        'app.setup_completed': {
          key: 'app.setup_completed',
          value: 'true',
          type: 'boolean',
          description: 'Setup completion flag',
          validation: {
            required: true,
            type: 'boolean',
            errorMessage: 'Setup completed flag must be a boolean value'
          },
          system_config: true
        }
      });

      const validResult = await ConfigValidator.validateField(
        'app.setup_completed', 
        'true', 
        {}
      );
      expect(validResult.valid).toBe(true);

      const invalidResult = await ConfigValidator.validateField(
        'app.setup_completed', 
        'maybe', 
        {}
      );
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Setup completed flag must be a boolean value');
    });

    it('should validate field without validation rules', async () => {
      vi.mocked(ConfigService.getAllWithValidation).mockResolvedValue({});

      const result = await ConfigValidator.validateField('unknown.key', 'any-value', {});
      
      expect(result.valid).toBe(true);
    });
  });

  describe('validateAll', () => {
    it('should validate all configuration fields', async () => {
      vi.mocked(ConfigService.getAllWithValidation).mockResolvedValue({
        'test.required': {
          key: 'test.required',
          value: 'value',
          type: 'string',
          description: 'Required field',
          validation: {
            required: true,
            errorMessage: 'This field is required'
          },
          system_config: false
        },
        'test.optional': {
          key: 'test.optional',
          value: '',
          type: 'string',
          description: 'Optional field',
          validation: {
            required: false,
            errorMessage: 'This field is optional'
          },
          system_config: false
        }
      });

      const config = {
        'test.required': 'valid-value',
        'test.optional': ''
      };

      const result = await ConfigValidator.validateAll(config);
      
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should return validation errors for invalid configuration', async () => {
      vi.mocked(ConfigService.getAllWithValidation).mockResolvedValue({
        'test.required': {
          key: 'test.required',
          value: '',
          type: 'string',
          description: 'Required field',
          validation: {
            required: true,
            errorMessage: 'This field is required'
          },
          system_config: false
        }
      });

      const config = {
        'test.required': ''
      };

      const result = await ConfigValidator.validateAll(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors['test.required']).toBe('This field is required');
    });
  });

  describe('dependency validation', () => {
    it('should validate storage type dependencies', async () => {
      vi.mocked(ConfigService.getAllWithValidation).mockResolvedValue({
        'storage.r2.bucket': {
          key: 'storage.r2.bucket',
          value: 'test-bucket',
          type: 'string',
          description: 'R2 bucket name',
          validation: {
            required: false,
            pattern: '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$',
            errorMessage: 'R2 bucket name must be in valid format'
          },
          system_config: true
        }
      });

      const config = {
        'storage.type': 'gdrive',
        'storage.r2.bucket': 'test-bucket'
      };

      const result = await ConfigValidator.validateField('storage.r2.bucket', 'test-bucket', config);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('R2 configuration is only valid when storage type is r2');
    });
  });
});