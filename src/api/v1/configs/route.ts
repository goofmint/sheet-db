import { createRoute } from '@hono/zod-openapi';
import { Hono } from 'hono';
import type { Env } from '../../../types/env';
import { getConfigsListHandler } from '.';
import { getConfigByKeyHandler } from './get';
import { createConfigHandler } from './post';
import { updateConfigHandler } from './put';
import { deleteConfigHandler } from './delete';
import { configKeyParamSchema, CreateConfigRequestSchema, CreateConfigResponseSchema,
  ConfigItemResponseSchema, ConfigsListResponseSchema, configsListQuerySchema, UpdateConfigRequestSchema, UpdateConfigResponseSchema, DeleteConfigResponseSchema, ErrorResponseSchema } from './schema';

// Common error responses
const commonErrorResponses = {
  400: {
    content: {
      'application/json': {
        schema: ErrorResponseSchema
      }
    },
    description: 'Bad request'
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
    description: 'Not found'
  },
  500: {
    content: {
      'application/json': {
        schema: ErrorResponseSchema
      }
    },
    description: 'Internal server error'
  }
};

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
    ...commonErrorResponses
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
    ...commonErrorResponses
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
    409: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Conflict - Configuration key already exists'
    },
    ...commonErrorResponses
  }
});

// PUT /api/v1/configs/{key} - Update configuration
export const updateConfigRoute = createRoute({
  method: 'put',
  path: '/configs/{key}',
  summary: 'Update configuration item by key',
  description: 'Update an existing configuration item with new values',
  tags: ['Configuration'],
  security: [{ bearerAuth: [] }],
  request: {
    params: configKeyParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateConfigRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UpdateConfigResponseSchema
        }
      },
      description: 'Configuration updated successfully'
    },
    ...commonErrorResponses
  }
});

// DELETE /api/v1/configs/{key} - Delete configuration
export const deleteConfigRoute = createRoute({
  method: 'delete',
  path: '/configs/{key}',
  summary: 'Delete configuration item by key',
  description: 'Delete an existing configuration item by its key',
  tags: ['Configuration'],
  security: [{ bearerAuth: [] }],
  request: {
    params: configKeyParamSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DeleteConfigResponseSchema
        }
      },
      description: 'Configuration deleted successfully'
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Forbidden - Cannot delete system configuration'
    },
    ...commonErrorResponses
  }
});

// Traditional Hono router for backwards compatibility
const configRouter = new Hono<{ Bindings: Env }>();

// GET /api/v1/configs - List configurations
configRouter.get('/', getConfigsListHandler);

// GET /api/v1/configs/:key - Get configuration by key
configRouter.get('/:key', getConfigByKeyHandler);

// POST /api/v1/configs - Create configuration
configRouter.post('/', createConfigHandler);

// PUT /api/v1/configs/:key - Update configuration
configRouter.put('/:key', updateConfigHandler);

// DELETE /api/v1/configs/:key - Delete configuration
configRouter.delete('/:key', deleteConfigHandler);

export default configRouter;