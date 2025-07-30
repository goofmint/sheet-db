import { createRoute, z } from '@hono/zod-openapi';

// Health Check Schemas - matching actual handler response
const HealthResponseSchema = z.object({
  status: z.string().openapi({ example: 'healthy' }),
  timestamp: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  service: z.string().openapi({ example: 'sheetDB' }),
  version: z.string().openapi({ example: '1.0.0' }),
});

const ErrorSchema = z.object({
  error: z.string().openapi({ example: 'Internal Server Error' }),
  message: z.string().openapi({ example: 'An unexpected error occurred' }),
});

// Health Check Route
export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Health Check',
  description: 'Check the health status of the API',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
      description: 'API is healthy',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Server error',
    },
  },
});