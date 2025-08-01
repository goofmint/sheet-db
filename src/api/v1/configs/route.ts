import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

// レスポンススキーマ定義
const ConfigItemSchema = z.object({
  key: z.string().openapi({ example: 'google.client_id' }),
  value: z.string().openapi({ example: '12345-abcdef.apps.googleusercontent.com' }),
  type: z.enum(['string', 'boolean', 'number', 'json']),
  description: z.string().nullable(),
  system_config: z.boolean(),
  validation: z.object({
    required: z.boolean().optional(),
    type: z.enum(['string', 'boolean', 'number', 'json']).optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.string()).optional(),
    errorMessage: z.string(),
    default: z.union([z.string(), z.number(), z.boolean()]).optional()
  }).nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable()
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
  }),
  message: z.string().optional()
}).openapi('ConfigsListResponse');

const ErrorResponseSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  error: z.object({
    code: z.enum(['UNAUTHORIZED', 'FORBIDDEN', 'VALIDATION_ERROR', 'INVALID_KEY', 'NOT_FOUND', 'INTERNAL_ERROR']),
    message: z.string(),
    details: z.record(z.string()).optional()
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

// ルート定義
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

// Individual config item response schema
const ConfigItemResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: ConfigItemSchema,
  message: z.string().optional()
}).openapi('ConfigItemResponse');

// Path parameter schema for individual config
const configKeyParamSchema = z.object({
  key: z.string().openapi({ example: 'google.client_id' })
});

// Individual config route definition
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