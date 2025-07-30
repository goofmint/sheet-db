import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import type { Env } from '@/types/env';

/**
 * OpenAPI-enabled API Router
 * Provides auto-generated OpenAPI documentation with Swagger UI
 */
const openapi = new OpenAPIHono<{ Bindings: Env }>();

// Health check endpoint schema
const HealthSchema = z.object({
  status: z.string().openapi({ example: 'ok' }),
  timestamp: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  version: z.string().openapi({ example: '1.0.0' }),
});

// Health check route
const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Health Check',
  description: 'Check the health status of the API',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthSchema,
        },
      },
      description: 'API is healthy',
    },
  },
});

openapi.openapi(healthRoute, async (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Setup endpoints schema
const SetupStatusSchema = z.object({
  isSetupCompleted: z.boolean().openapi({ example: false }),
  requiredFields: z.array(z.string()).openapi({ example: ['google.client_id', 'google.client_secret'] }),
});

const SetupConfigSchema = z.object({
  'google.client_id': z.string().optional().openapi({ example: 'your-google-client-id' }),
  'google.client_secret': z.string().optional().openapi({ example: 'your-google-client-secret' }),
  'auth0.domain': z.string().optional().openapi({ example: 'your-domain.auth0.com' }),
  'auth0.client_id': z.string().optional().openapi({ example: 'your-auth0-client-id' }),
  'auth0.client_secret': z.string().optional().openapi({ example: 'your-auth0-client-secret' }),
  'app.cache_duration': z.number().optional().openapi({ example: 600 }),
  csrf_token: z.string().openapi({ example: 'csrf-token-value' }),
});

// Setup status route
const setupStatusRoute = createRoute({
  method: 'get',
  path: '/setup',
  tags: ['Setup'],
  summary: 'Get Setup Status',
  description: 'Check if the application setup is completed',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SetupStatusSchema,
        },
      },
      description: 'Setup status information',
    },
  },
});

// Setup configuration route
const setupConfigRoute = createRoute({
  method: 'post',
  path: '/setup',
  tags: ['Setup'],
  summary: 'Submit Setup Configuration',
  description: 'Submit configuration settings for initial application setup',
  request: {
    body: {
      content: {
        'application/json': {
          schema: SetupConfigSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      description: 'Configuration saved successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            details: z.array(z.string()).optional(),
          }),
        },
      },
      description: 'Validation error',
    },
  },
});

// Sheets endpoints schema
const SheetsCreateSchema = z.object({
  name: z.string().openapi({ example: 'My Sheet' }),
  headers: z.array(z.string()).optional().openapi({ example: ['Name', 'Email', 'Age'] }),
});

const SheetsResponseSchema = z.object({
  id: z.string().openapi({ example: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' }),
  name: z.string().openapi({ example: 'My Sheet' }),
  url: z.string().openapi({ example: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' }),
});

// Sheets creation route
const sheetsCreateRoute = createRoute({
  method: 'post',
  path: '/sheets',
  tags: ['Sheets'],
  summary: 'Create Sheet',
  description: 'Create or initialize a new Google Sheet',
  request: {
    body: {
      content: {
        'application/json': {
          schema: SheetsCreateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: SheetsResponseSchema,
        },
      },
      description: 'Sheet created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Invalid request',
    },
  },
});

// Storage endpoints schema
const StorageUploadSchema = z.object({
  file: z.any().openapi({ type: 'string', format: 'binary' }),
  path: z.string().optional().openapi({ example: 'uploads/document.pdf' }),
});

const StorageResponseSchema = z.object({
  id: z.string().openapi({ example: 'file-123' }),
  url: z.string().openapi({ example: 'https://storage.example.com/file-123' }),
  path: z.string().openapi({ example: 'uploads/document.pdf' }),
  size: z.number().openapi({ example: 1024 }),
});

// Storage upload route
const storageUploadRoute = createRoute({
  method: 'post',
  path: '/storages',
  tags: ['Storage'],
  summary: 'Upload File',
  description: 'Upload a file to storage',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: StorageUploadSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: StorageResponseSchema,
        },
      },
      description: 'File uploaded successfully',
    },
  },
});

// Storage delete route
const storageDeleteRoute = createRoute({
  method: 'delete',
  path: '/storages/{id}',
  tags: ['Storage'],
  summary: 'Delete File',
  description: 'Delete a file from storage',
  request: {
    params: z.object({
      id: z.string().openapi({ example: 'file-123' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      description: 'File deleted successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'File not found',
    },
  },
});

// Auth endpoints schema
const UserSchema = z.object({
  id: z.string().openapi({ example: 'user-123' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  name: z.string().openapi({ example: 'John Doe' }),
  picture: z.string().url().optional().openapi({ example: 'https://example.com/avatar.jpg' }),
});

// Auth me route
const authMeRoute = createRoute({
  method: 'get',
  path: '/auth/me',
  tags: ['Authentication'],
  summary: 'Get Current User',
  description: 'Get information about the currently authenticated user',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
      description: 'User information',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Not authenticated',
    },
  },
});

// Playground route
const playgroundRoute = createRoute({
  method: 'get',
  path: '/playground',
  tags: ['Utilities'],
  summary: 'API Playground',
  description: 'Interactive API testing interface',
  responses: {
    200: {
      content: {
        'text/html': {
          schema: z.string(),
        },
      },
      description: 'HTML playground interface',
    },
  },
});

// Note: We're not implementing the handlers here, just the OpenAPI documentation
// The actual handlers will be imported from existing route files

// Swagger UI
openapi.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Sheet DB API',
    description: 'Backend-as-a-Service using Google Sheets as database',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
});

openapi.get('/ui', swaggerUI({ url: '/api/v1/doc' }));

export { openapi };
export default openapi;