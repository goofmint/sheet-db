import { createRoute, z } from '@hono/zod-openapi';

// Standard Error Schema
const ErrorSchema = z.object({
  error: z.object({
    code: z.string().openapi({ example: 'AUTHENTICATION_REQUIRED' }),
    message: z.string().openapi({ example: 'Authorization header with Bearer token required' }),
  }),
});

// Setup Status Response Schema
const SetupStatusResponseSchema = z.object({
  setup: z.object({
    isCompleted: z.boolean().openapi({ example: false }),
    requiredFields: z.array(z.string()).openapi({ 
      example: ['google.client_id', 'google.client_secret', 'auth0.domain'] 
    }),
    completedFields: z.array(z.string()).openapi({ 
      example: ['google.client_id'] 
    }),
    currentConfig: z.object({
      google: z.object({
        clientId: z.string().optional().openapi({ example: 'your-google-client-id' }),
        clientSecret: z.string().optional().openapi({ example: 'your-google-client-secret' }),
      }).optional(),
      auth0: z.object({
        domain: z.string().optional().openapi({ example: 'your-domain.auth0.com' }),
        clientId: z.string().optional().openapi({ example: 'your-auth0-client-id' }),
        clientSecret: z.string().optional().openapi({ example: 'your-auth0-client-secret' }),
      }).optional(),
      hasGoogleCredentials: z.boolean().optional().openapi({ example: true }),
      hasAuth0Config: z.boolean().optional().openapi({ example: false }),
    }),
    nextSteps: z.array(z.string()).openapi({
      example: ['Configure Auth0 settings', 'Set configuration password']
    }),
    progress: z.object({
      percentage: z.number().openapi({ example: 33 }),
      completedSteps: z.number().openapi({ example: 2 }),
      totalSteps: z.number().openapi({ example: 6 }),
    }),
  }),
  timestamp: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
});

// Setup Config Request Schema
const SetupConfigRequestSchema = z.object({
  'google.client_id': z.string().optional().openapi({ example: 'your-google-client-id' }),
  'google.client_secret': z.string().optional().openapi({ example: 'your-google-client-secret' }),
  'auth0.domain': z.string().optional().openapi({ example: 'your-domain.auth0.com' }),
  'auth0.client_id': z.string().optional().openapi({ example: 'your-auth0-client-id' }),
  'auth0.client_secret': z.string().optional().openapi({ example: 'your-auth0-client-secret' }),
  'app.cache_duration': z.number().optional().openapi({ example: 600 }),
  'app.config_password': z.string().optional().openapi({ example: 'secure-password' }),
  csrf_token: z.string().optional().openapi({ example: 'csrf-token-value' }),
});

// Setup Config Response Schema
const SetupConfigResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: 'Configuration saved successfully' }),
  completedFields: z.array(z.string()).optional().openapi({
    example: ['google.client_id', 'google.client_secret']
  }),
});

// Setup Status Route
export const setupStatusRoute = createRoute({
  method: 'get',
  path: '/setup',
  tags: ['Setup'],
  summary: 'Get Setup Status',
  description: 'Check if the application setup is completed and get current configuration status',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SetupStatusResponseSchema,
        },
      },
      description: 'Setup status information',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Authentication required when setup is completed',
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
export const setupConfigRoute = createRoute({
  method: 'post',
  path: '/setup',
  tags: ['Setup'],
  summary: 'Submit Setup Configuration',
  description: 'Submit configuration settings for initial application setup or update existing configuration',
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
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Authentication required when setup is completed',
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