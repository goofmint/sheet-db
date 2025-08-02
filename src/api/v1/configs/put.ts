import { Context } from 'hono';
import { ConfigService } from '../../../services/config';
import { checkConfigAuthentication } from '../../../utils/auth';
import type { ConfigType } from '../../../db/schema';
import { UpdateConfigRequestSchema } from './schema';
import { convertConfigValue } from './utils';

// PUT /api/v1/configs/:key - Update existing configuration item
export async function updateConfigHandler(c: Context) {
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
    // Get key from URL params
    const key = c.req.param('key');
    
    // Validate key format
    if (!key || key.trim() === '') {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR' as const,
          message: 'Configuration key cannot be empty'
        }
      }, 400);
    }

    // Parse and validate request body with Zod schema
    const requestBody = await c.req.json();
    const validationResult = UpdateConfigRequestSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      const errors: Record<string, string[]> = {};
      validationResult.error.issues.forEach(issue => {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });

      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR' as const,
          message: 'Invalid configuration data',
          details: errors
        }
      }, 400);
    }

    const body = validationResult.data;

    // Additional value size validation (max 64KB)
    const valueString = body.type === 'json' ? JSON.stringify(body.value) : String(body.value);
    if (new TextEncoder().encode(valueString).length > 65536) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR' as const,
          message: 'Invalid configuration data',
          details: {
            value: ['Value exceeds maximum size of 64KB']
          }
        }
      }, 400);
    }

    // Validate value type consistency
    if (body.type === 'number' && typeof body.value !== 'number') {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR' as const,
          message: 'Invalid configuration data',
          details: {
            value: ['Value must be a number for type "number"']
          }
        }
      }, 400);
    }

    if (body.type === 'boolean' && typeof body.value !== 'boolean') {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR' as const,
          message: 'Invalid configuration data',
          details: {
            value: ['Value must be a boolean for type "boolean"']
          }
        }
      }, 400);
    }

    if (body.type === 'json' && typeof body.value !== 'object') {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR' as const,
          message: 'Invalid configuration data',
          details: {
            value: ['Value must be an object for type "json"']
          }
        }
      }, 400);
    }

    // Validate validation rules against type
    if (body.validation) {
      if ((body.validation.min !== undefined || body.validation.max !== undefined) && body.type !== 'number') {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR' as const,
            message: 'Invalid configuration data',
            details: {
              validation: ['min/max validation is only applicable for number type']
            }
          }
        }, 400);
      }

      if ((body.validation.minLength !== undefined || body.validation.maxLength !== undefined) && body.type !== 'string') {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR' as const,
            message: 'Invalid configuration data',
            details: {
              validation: ['minLength/maxLength validation is only applicable for string type']
            }
          }
        }, 400);
      }

      if (body.validation.pattern !== undefined && body.type !== 'string') {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR' as const,
            message: 'Invalid configuration data',
            details: {
              validation: ['pattern validation is only applicable for string type']
            }
          }
        }, 400);
      }

      // Validate regex pattern
      if (body.validation.pattern) {
        try {
          new RegExp(body.validation.pattern);
        } catch {
          return c.json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR' as const,
              message: 'Invalid configuration data',
              details: {
                validation: ['Invalid regular expression pattern']
              }
            }
          }, 400);
        }
      }
    }

    // Update configuration
    try {
      const updated = await ConfigService.updateConfig(key, {
        value: body.value,
        type: body.type as ConfigType,
        description: body.description,
        system_config: body.system_config,
        validation: body.validation ? JSON.stringify(body.validation) : undefined
      });

      // Parse validation field and convert system_config to boolean
      const response = {
        id: String(updated.id),
        key: updated.key,
        value: convertConfigValue(updated.value, updated.type),
        type: updated.type,
        description: updated.description,
        system_config: updated.system_config === 1,
        validation: (() => {
          try {
            return updated.validation ? JSON.parse(updated.validation) : null;
          } catch {
            return null;
          }
        })(),
        created_at: updated.created_at,
        updated_at: updated.updated_at
      };

      return c.json({
        success: true,
        data: response
      }, 200);

    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        return c.json({
          success: false,
          error: {
            code: 'NOT_FOUND' as const,
            message: `Configuration with key '${key}' not found`
          }
        }, 404);
      }
      
      console.error('Config update error:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR' as const,
          message: 'Failed to update configuration'
        }
      }, 500);
    }

  } catch (error) {
    console.error('Unexpected error in config update:', error);
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR' as const,
        message: 'Failed to update configuration'
      }
    }, 500);
  }
}