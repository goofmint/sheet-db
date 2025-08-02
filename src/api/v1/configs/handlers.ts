import { OpenAPIHono } from '@hono/zod-openapi';
import { ConfigService } from '../../../services/config';
import { checkConfigAuthentication } from '../../../utils/auth';
import type { Env } from '../../../types/env';
import type { ConfigType } from '../../../db/schema';
import { getConfigsListRoute, getConfigByKeyRoute, createConfigRoute } from './route';

const app = new OpenAPIHono<{ Bindings: Env }>();

// GET /api/v1/configs - List configurations
app.openapi(getConfigsListRoute, async (c) => {
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
    const query = c.req.valid('query');
    
    const result = await ConfigService.getConfigsList({
      page: query.page,
      limit: query.limit,
      search: query.search || '',
      type: query.type,
      system: query.system,
      sort: query.sort,
      order: query.order
    });
    
    // Convert configs response
    const configs = result.configs.map((config: any) => ({
      id: String(config.id),
      key: config.key,
      value: config.type === 'json' ? JSON.parse(config.value) : config.value,
      type: config.type,
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
    }));

    return c.json({
      success: true,
      data: {
        configs,
        pagination: result.pagination
      }
    }, 200);

  } catch (error) {
    console.error('Get configs list error:', error);
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR' as const,
        message: 'Failed to retrieve configuration list'
      }
    }, 500);
  }
});

// GET /api/v1/configs/:key - Get configuration by key
app.openapi(getConfigByKeyRoute, async (c) => {
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
    const { key } = c.req.valid('param');

    const config = ConfigService.findByKey(key);
    if (!config) {
      return c.json({
        success: false,
        error: {
          code: 'NOT_FOUND' as const,
          message: 'Configuration not found'
        }
      }, 404);
    }

    const response = {
      id: String(config.id),
      key: config.key,
      value: config.type === 'json' ? JSON.parse(config.value) : config.value,
      type: config.type,
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
      data: response
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
});

// POST /api/v1/configs - Create configuration
app.openapi(createConfigRoute, async (c) => {
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
    const data = c.req.valid('json');

    // Validate value against type
    if (data.type === 'number' && typeof data.value !== 'number') {
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

    if (data.type === 'boolean' && typeof data.value !== 'boolean') {
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

    if (data.type === 'json' && typeof data.value !== 'object') {
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

    // Validate value size (max 64KB)
    const valueString = data.type === 'json' ? JSON.stringify(data.value) : String(data.value);
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

    // Validate validation rules against type
    if (data.validation) {
      if ((data.validation.min !== undefined || data.validation.max !== undefined) && data.type !== 'number') {
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

      if (data.validation.pattern !== undefined && data.type !== 'string') {
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
      if (data.validation.pattern) {
        try {
          new RegExp(data.validation.pattern);
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

    // Create configuration
    try {
      const created = await ConfigService.createConfig({
        key: data.key,
        value: data.value,
        type: data.type as ConfigType,
        description: data.description,
        system_config: data.system_config,
        validation: data.validation ? JSON.stringify(data.validation) : undefined
      });

      // Parse validation field and convert system_config to boolean
      const response = {
        id: String(created.id),
        key: created.key,
        value: data.type === 'json' ? data.value : created.value,
        type: created.type,
        description: created.description,
        system_config: created.system_config === 1,
        validation: data.validation || null,
        created_at: created.created_at,
        updated_at: created.updated_at
      };

      return c.json({
        success: true,
        data: response
      }, 201);

    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE_KEY') {
        return c.json({
          success: false,
          error: {
            code: 'DUPLICATE_KEY' as const,
            message: 'Configuration key already exists'
          }
        }, 409);
      }
      throw error;
    }

  } catch (error) {
    console.error('Create config error:', error);
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR' as const,
        message: 'Failed to create configuration'
      }
    }, 500);
  }
});

export default app;