import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

// レスポンススキーマ定義
const ConfigItemSchema = z.object({
  id: z.string().openapi({ example: 'd7f3c6e1-3e6b-46cf-a07c-e4d4ac9b7c1d' }),
  key: z.string().openapi({ example: 'google.client_id' }),
  value: z.union([z.string(), z.number(), z.boolean(), z.object({}).passthrough()]).openapi({ example: '12345-abcdef.apps.googleusercontent.com' }),
  type: z.enum(['string', 'boolean', 'number', 'json']),
  description: z.string().nullable(),
  system_config: z.boolean(),
  validation: z.object({
    required: z.boolean().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.unknown()).optional()
  }).nullable(),
  created_at: z.string(),
  updated_at: z.string()
}).openapi('ConfigItem');

const PaginationSchema = z.object({
  total: z.number().openapi({ example: 15 }),
  page: z.number().openapi({ example: 1 }),
  limit: z.number().openapi({ example: 50 }),
  totalPages: z.number().openapi({ example: 1 }),
  hasNext: z.boolean().openapi({ example: false }),
  hasPrev: z.boolean().openapi({ example: false })
}).openapi('Pagination');

const ConfigsListResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: z.object({
    configs: z.array(ConfigItemSchema),
    pagination: PaginationSchema
  })
}).openapi('ConfigsListResponse');

const ConfigItemResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: ConfigItemSchema
}).openapi('ConfigItemResponse');

const CreateConfigRequestSchema = z.object({
  key: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_.-]+$/).openapi({ 
    example: 'api_key',
    description: 'Unique configuration key'
  }),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.object({}).passthrough()
  ]).openapi({ 
    example: 'sk-abc123',
    description: 'Configuration value'
  }),
  type: z.enum(['string', 'number', 'boolean', 'json']).openapi({ 
    example: 'string',
    description: 'Value type'
  }),
  description: z.string().max(1000).optional().openapi({ 
    example: 'API Key for external service',
    description: 'Configuration description'
  }),
  system_config: z.boolean().optional().openapi({ 
    example: false,
    description: 'System configuration flag'
  }),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.unknown()).optional(),
    required: z.boolean().optional()
  }).optional().openapi({ 
    description: 'Validation rules for the configuration value'
  })
}).openapi('CreateConfigRequest');

const CreateConfigResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: ConfigItemSchema
}).openapi('CreateConfigResponse');

const ErrorResponseSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  error: z.object({
    code: z.enum(['UNAUTHORIZED', 'FORBIDDEN', 'VALIDATION_ERROR', 'DUPLICATE_KEY', 'NOT_FOUND', 'INTERNAL_ERROR']),
    message: z.string(),
    details: z.record(z.array(z.string())).optional()
  })
}).openapi('ErrorResponse');

// クエリパラメータスキーマ
const configsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce.number().int().min(1).max(100).default(50).openapi({ example: 20 }),
  search: z.string().optional().default('').openapi({ example: 'google' }),
  type: z.enum(['string', 'boolean', 'number', 'json']).optional().openapi({ example: 'string' }),
  system: z.coerce.boolean().optional().openapi({ example: true }),
  sort: z.enum(['key', 'type', 'created_at', 'updated_at']).default('key').openapi({ example: 'key' }),
  order: z.enum(['asc', 'desc']).default('asc').openapi({ example: 'asc' })
});

const configKeyParamSchema = z.object({
  key: z.string().openapi({ example: 'google.client_id' })
});

// GET /api/v1/configs - List configurations
export const getConfigsListRoute = createRoute({
  method: 'get',
  path: '/configs',
  summary: 'List all configuration items',
  description: 'Retrieve a paginated list of configuration items with optional filtering and sorting',
  tags: ['Configuration'],
  security: [{ bearerAuth: [] }],
  request: {
    query: configsListQuerySchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ConfigsListResponseSchema
        }
      },
      description: 'Successful response'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Bad request - Invalid query parameters'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Unauthorized - Authentication required'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Internal server error'
    }
  }
});

// GET /api/v1/configs/:key - Get configuration by key
export const getConfigByKeyRoute = createRoute({
  method: 'get',
  path: '/configs/{key}',
  summary: 'Get configuration item by key',
  description: 'Retrieve a specific configuration item by its key',
  tags: ['Configuration'],
  security: [{ bearerAuth: [] }],
  request: {
    params: configKeyParamSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ConfigItemResponseSchema
        }
      },
      description: 'Successful response'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Bad request - Invalid key format'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Unauthorized - Authentication required'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Configuration item not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Internal server error'
    }
  }
});

// POST /api/v1/configs - Create configuration
export const createConfigRoute = createRoute({
  method: 'post',
  path: '/configs',
  summary: 'Create new configuration item',
  description: 'Create a new configuration item with the specified key and value',
  tags: ['Configuration'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateConfigRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: CreateConfigResponseSchema
        }
      },
      description: 'Configuration created successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Bad request - Invalid configuration data'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Unauthorized - Authentication required'
    },
    409: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Conflict - Configuration key already exists'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Internal server error'
    }
  }
});