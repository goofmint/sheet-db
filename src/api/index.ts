import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import healthRouter from './v1/health/route';
import setupRouter from './v1/setup/route';
import sheetsRouter from './v1/sheets/route';
import playgroundRouter from './v1/playground/route';
import storagesRouter from './v1/storages/route';
import authRouter from './v1/auth';
import type { Env } from '@/types/env';

/**
 * API Router - Centralized routing for all API endpoints
 * Provides RESTful API structure with consistent error handling
 */
const api = new Hono<{ Bindings: Env }>();

// API-specific middleware
api.use('*', cors({
  origin: (origin) => {
    // TODO: Load allowed origins from ConfigService
    // For now, allow all origins for development
    return origin;
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// API versioning prefix - using OpenAPIHono for v1 to support OpenAPI endpoints
const v1 = new OpenAPIHono<{ Bindings: Env }>();

// Health routes
v1.route('/health', healthRouter);

// Setup routes
v1.route('/setup', setupRouter);

// Sheets routes
v1.route('/sheets', sheetsRouter);

// Storage routes
v1.route('/storages', storagesRouter);

// Playground routes
v1.route('/playground', playgroundRouter);

// Auth routes
v1.route('/auth', authRouter);

// Mount v1 API routes
api.route('/v1', v1);

// OpenAPI documentation routes
api.get('/v1/doc', async (c) => {
  // Manual OpenAPI documentation for now
  const openAPIDoc = {
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
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health Check',
          description: 'Check the health status of the API',
          responses: {
            200: {
              description: 'API is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        example: 'healthy'
                      },
                      timestamp: {
                        type: 'string',
                        example: '2024-01-01T00:00:00.000Z'
                      },
                      service: {
                        type: 'string',
                        example: 'sheetDB'
                      },
                      version: {
                        type: 'string',
                        example: '1.0.0'
                      }
                    },
                    required: ['status', 'timestamp', 'service', 'version']
                  }
                }
              }
            },
            500: {
              description: 'Server error',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: {
                        type: 'string',
                        example: 'Internal Server Error'
                      },
                      message: {
                        type: 'string',
                        example: 'An unexpected error occurred'
                      }
                    },
                    required: ['error', 'message']
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {}
    }
  };

  return c.json(openAPIDoc);
});

api.get('/v1/ui', swaggerUI({ url: '/api/v1/doc' }));

// API root endpoint - provides API information
api.get('/', async (c) => {
  return c.json({
    name: 'Sheet DB API',
    version: '1.0.0',
    description: 'Backend-as-a-Service using Google Sheets as database',
    timestamp: new Date().toISOString(),
    documentation: {
      openapi: '/api/v1/doc',
      swagger_ui: '/api/v1/ui',
    },
  });
});


export { api };
export default api;