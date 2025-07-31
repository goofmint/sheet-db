import { createRoute } from '@hono/zod-openapi';
import { CreateSheetRequestSchema, SheetSuccessResponseSchema, SheetErrorSchema } from './types';

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

// Future route definitions will be added here
// export const listSheetsRoute = createRoute({ ... });
// export const getSheetRoute = createRoute({ ... });
// export const updateSheetRoute = createRoute({ ... });
// export const deleteSheetRoute = createRoute({ ... });