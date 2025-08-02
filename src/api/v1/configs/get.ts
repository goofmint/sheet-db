import { Context } from 'hono';
import { ConfigService } from '../../../services/config';
import { checkConfigAuthentication } from '../../../utils/auth';
import { convertConfigValue } from './utils';

// GET /api/v1/configs/:key - Get individual configuration item
export async function getConfigByKeyHandler(c: Context) {
  // Authentication check
  const isAuthenticated = await checkConfigAuthentication(c);
  if (!isAuthenticated) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED' as const,
        message: 'Authentication required'
      }
    }, 401);
  }

  try {
    const key = c.req.param('key');
    
    // Validate key format
    if (!key || key.trim() === '') {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_KEY' as const,
          message: 'Configuration key cannot be empty'
        }
      }, 400);
    }
    
    // Get configuration by key
    const config = ConfigService.findByKey(key);
    
    if (!config) {
      return c.json({
        success: false,
        error: {
          code: 'NOT_FOUND' as const,
          message: `Configuration with key '${key}' not found`
        }
      }, 404);
    }
    
    // Build response data with proper type conversion
    const responseData = {
      key: config.key,
      value: convertConfigValue(config.value, config.type),
      type: (['string', 'boolean', 'number', 'json'] as const).includes(config.type as 'string' | 'boolean' | 'number' | 'json')
        ? (config.type as 'string' | 'boolean' | 'number' | 'json')
        : 'string', // fallback to string if invalid
      description: config.description,
      system_config: config.system_config === 1,
      validation: (() => {
        try {
          return config.validation ? JSON.parse(config.validation) : null;
        } catch {
          return null;
        }
      })(),
      created_at: config.created_at,
      updated_at: config.updated_at
    };

    return c.json({
      success: true,
      data: responseData
    }, 200);

  } catch (error) {
    console.error('Get config by key error:', error);
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR' as const,
        message: 'Failed to retrieve configuration'
      }
    }, 500);
  }
};
