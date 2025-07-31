import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validationRulesHandler } from '../../../../src/api/v1/config/validation-rules';
import { ConfigService } from '../../../../src/services/config';

// Mock dependencies
vi.mock('../../../../src/services/config', () => ({
  ConfigService: {
    isInitialized: vi.fn(),
    initialize: vi.fn(),
    getAllWithValidation: vi.fn(),
  }
}));

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => ({}))
}));

describe('Validation Rules API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockContext = (env = {}) => ({
    env: { DB: {}, ...env },
    json: vi.fn()
  });

  it('should return validation rules successfully', async () => {
    const mockContext = createMockContext();
    
    vi.mocked(ConfigService.isInitialized).mockReturnValue(true);
    vi.mocked(ConfigService.getAllWithValidation).mockReturnValue({
      'google.client_id': {
        key: 'google.client_id',
        value: '12345-test.apps.googleusercontent.com',
        type: 'string',
        description: 'Google Client ID',
        validation: {
          required: true,
          pattern: '^[0-9]+-[a-zA-Z0-9]+\\.apps\\.googleusercontent\\.com$',
          errorMessage: 'Invalid Google Client ID format'
        },
        system_config: true
      },
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
      },
      'test.no_validation': {
        key: 'test.no_validation',
        value: 'test',
        type: 'string',
        description: 'Field without validation',
        validation: null,
        system_config: false
      }
    });

    await validationRulesHandler(mockContext as any);

    expect(mockContext.json).toHaveBeenCalledWith({
      'google.client_id': {
        required: true,
        pattern: '^[0-9]+-[a-zA-Z0-9]+\\.apps\\.googleusercontent\\.com$',
        errorMessage: 'Invalid Google Client ID format'
      },
      'cache.ttl_minutes': {
        required: true,
        type: 'number',
        min: 1,
        max: 1440,
        errorMessage: 'Cache TTL must be between 1 and 1440 minutes'
      }
    });
  });

  it('should initialize ConfigService if not initialized', async () => {
    const mockContext = createMockContext();
    
    vi.mocked(ConfigService.isInitialized).mockReturnValue(false);
    vi.mocked(ConfigService.getAllWithValidation).mockReturnValue({});

    await validationRulesHandler(mockContext as any);

    expect(ConfigService.initialize).toHaveBeenCalledWith({});
  });

  it('should handle errors gracefully', async () => {
    const mockContext = createMockContext();
    
    vi.mocked(ConfigService.isInitialized).mockReturnValue(true);
    vi.mocked(ConfigService.getAllWithValidation).mockImplementation(() => {
      throw new Error('Database error');
    });

    await validationRulesHandler(mockContext as any);

    expect(mockContext.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch validation rules'
      }
    }, 500);
  });

  it('should return empty object when no validation rules exist', async () => {
    const mockContext = createMockContext();
    
    vi.mocked(ConfigService.isInitialized).mockReturnValue(true);
    vi.mocked(ConfigService.getAllWithValidation).mockReturnValue({
      'test.field': {
        key: 'test.field',
        value: 'test',
        type: 'string',
        description: 'Test field',
        validation: null,
        system_config: false
      }
    });

    await validationRulesHandler(mockContext as any);

    expect(mockContext.json).toHaveBeenCalledWith({});
  });
});