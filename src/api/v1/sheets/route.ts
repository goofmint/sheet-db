import { createRoute } from '@hono/zod-openapi';
import { 
  CreateSheetRequestSchema, 
  SheetSuccessResponseSchema, 
  SheetErrorSchema,
  SheetsListQuerySchema,
  SheetsListResponseSchema
} from './types';

/**
 * OpenAPI route definition for creating/initializing sheets
 */
export const createSheetRoute = createRoute({
  method: 'post',
  path: '/v1/sheets',
  tags: ['Sheets'],
  summary: 'Create or Initialize Sheet',
  description: 'Create a new sheet or initialize a system sheet in Google Sheets',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateSheetRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: SheetSuccessResponseSchema
        }
      },
      description: 'Sheet created or initialized successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: SheetErrorSchema
        }
      },
      description: 'Invalid request or unsupported sheet name'
    },
    401: {
      content: {
        'application/json': {
          schema: SheetErrorSchema
        }
      },
      description: 'Authentication required'
    },
    403: {
      content: {
        'application/json': {
          schema: SheetErrorSchema
        }
      },
      description: 'Insufficient permissions'
    },
    409: {
      content: {
        'application/json': {
          schema: SheetErrorSchema
        }
      },
      description: 'Sheet already exists'
    },
    500: {
      content: {
        'application/json': {
          schema: SheetErrorSchema
        }
      },
      description: 'Server error during sheet initialization'
    }
  }
});

/**
 * OpenAPI route definition for listing sheets
 */
export const listSheetsRoute = createRoute({
  method: 'get',
  path: '/v1/sheets',
  tags: ['Sheets'],
  summary: 'List Sheets',
  description: 'Get a list of accessible sheets with their column information',
  request: {
    query: SheetsListQuerySchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SheetsListResponseSchema
        }
      },
      description: 'List of accessible sheets'
    },
    500: {
      content: {
        'application/json': {
          schema: SheetErrorSchema
        }
      },
      description: 'Server error during sheet retrieval'
    }
  }
});

// Future route definitions will be added here
// export const getSheetRoute = createRoute({ ... });
// export const updateSheetRoute = createRoute({ ... });
// export const deleteSheetRoute = createRoute({ ... });