import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import type { Env } from '@/types/env';

/**
 * OpenAPI-enabled API Router
 * Provides auto-generated OpenAPI documentation with Swagger UI
 */
const openapi = new OpenAPIHono<{ Bindings: Env }>();

// Standard Error Schema
const ErrorSchema = z.object({
  error: z.string().openapi({ example: 'Bad Request' }),
  message: z.string().openapi({ example: 'Validation failed' }),
  code: z.string().optional().openapi({ example: 'VALIDATION_ERROR' }),
  details: z.array(z.string()).optional().openapi({ example: ['Field name is required'] }),
});

// Health Check Schemas
const HealthResponseSchema = z.object({
  status: z.string().openapi({ example: 'ok' }),
  timestamp: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  version: z.string().openapi({ example: '1.0.0' }),
});

// Setup Schemas
const SetupStatusResponseSchema = z.object({
  isSetupCompleted: z.boolean().openapi({ example: false }),
  requiredFields: z.array(z.string()).openapi({ example: ['google.client_id', 'google.client_secret'] }),
});

const SetupConfigRequestSchema = z.object({
  'google.client_id': z.string().optional().openapi({ example: 'your-google-client-id' }),
  'google.client_secret': z.string().optional().openapi({ example: 'your-google-client-secret' }),
  'auth0.domain': z.string().optional().openapi({ example: 'your-domain.auth0.com' }),
  'auth0.client_id': z.string().optional().openapi({ example: 'your-auth0-client-id' }),
  'auth0.client_secret': z.string().optional().openapi({ example: 'your-auth0-client-secret' }),
  'app.cache_duration': z.number().optional().openapi({ example: 600 }),
  csrf_token: z.string().openapi({ example: 'csrf-token-value' }),
});

const SetupConfigResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: 'Configuration saved successfully' }),
});

// Sheets Schemas
const SheetsCreateRequestSchema = z.object({
  name: z.string().openapi({ example: 'My Sheet' }),
  headers: z.array(z.string()).optional().openapi({ example: ['Name', 'Email', 'Age'] }),
});

const SheetsCreateResponseSchema = z.object({
  id: z.string().openapi({ example: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' }),
  name: z.string().openapi({ example: 'My Sheet' }),
  url: z.string().openapi({ example: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' }),
});

// Storage Schemas
const StorageUploadResponseSchema = z.object({
  id: z.string().openapi({ example: 'file-123' }),
  url: z.string().openapi({ example: 'https://storage.example.com/file-123' }),
  path: z.string().openapi({ example: 'uploads/document.pdf' }),
  size: z.number().openapi({ example: 1024 }),
});

const StorageDeleteResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: 'File deleted successfully' }),
});

// Auth Schemas
const UserResponseSchema = z.object({
  id: z.string().openapi({ example: 'user-123' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  name: z.string().openapi({ example: 'John Doe' }),
  picture: z.string().url().optional().openapi({ example: 'https://example.com/avatar.jpg' }),
});

const AuthLogoutResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: 'Logged out successfully' }),
});

// Health Check Route
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

// Setup Status Route
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
          schema: SetupStatusResponseSchema,
        },
      },
      description: 'Setup status information',
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

// Setup Configuration Route
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
          schema: SetupConfigRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SetupConfigResponseSchema,
        },
      },
      description: 'Configuration saved successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Validation error',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'CSRF token invalid',
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

// Sheets Creation Route
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
          schema: SheetsCreateRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: SheetsCreateResponseSchema,
        },
      },
      description: 'Sheet created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Validation error',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Authentication required',
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

// Storage Upload Route
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
          schema: z.object({
            file: z.any().openapi({ type: 'string', format: 'binary' }),
            path: z.string().optional().openapi({ example: 'uploads/document.pdf' }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: StorageUploadResponseSchema,
        },
      },
      description: 'File uploaded successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'No file or validation errors',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Authentication required',
    },
    413: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'File too large',
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

// Storage Delete Route
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
          schema: StorageDeleteResponseSchema,
        },
      },
      description: 'File deleted successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Authentication required',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'File not found',
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

// Playground Route
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

// Auth Login Route
const authLoginRoute = createRoute({
  method: 'get',
  path: '/auth/login',
  tags: ['Authentication'],
  summary: 'Initiate Auth0 Login',
  description: 'Redirect to Auth0 authorization endpoint',
  responses: {
    302: {
      description: 'Redirect to Auth0 authorization endpoint',
      headers: z.object({
        Location: z.string().openapi({ example: 'https://domain.auth0.com/authorize?...' }),
      }),
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

// Auth Callback Route
const authCallbackRoute = createRoute({
  method: 'get',
  path: '/auth/callback',
  tags: ['Authentication'],
  summary: 'OAuth Callback',
  description: 'Handle OAuth callback from Auth0',
  request: {
    query: z.object({
      code: z.string().openapi({ example: 'authorization_code' }),
      state: z.string().openapi({ example: 'state_value' }),
    }),
  },
  responses: {
    302: {
      description: 'Redirect to application after successful login',
      headers: z.object({
        Location: z.string().openapi({ example: '/playground' }),
      }),
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Invalid code or state',
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

// Auth Logout Route
const authLogoutRoute = createRoute({
  method: 'post',
  path: '/auth/logout',
  tags: ['Authentication'],
  summary: 'Logout User',
  description: 'Logout the current user',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AuthLogoutResponseSchema,
        },
      },
      description: 'Logged out successfully',
    },
    302: {
      description: 'Redirect to logout page (alternative response)',
      headers: z.object({
        Location: z.string().openapi({ example: '/setup' }),
      }),
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

// Auth Me Route
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
          schema: UserResponseSchema,
        },
      },
      description: 'User information',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Not authenticated',
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

// Note: We're only defining the OpenAPI documentation routes here
// The actual handlers will be imported from existing route files

// OpenAPI documentation endpoint
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

// Swagger UI endpoint
openapi.get('/ui', swaggerUI({ url: '/api/v1/doc' }));

export { openapi };
export default openapi;