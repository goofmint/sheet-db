import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { healthRoute } from './v1/health/route';
import { healthHandler } from './v1/health/get';
import { setupStatusRoute, setupConfigRoute } from './v1/setup/route';
import { setupGetHandler } from './v1/setup/get';
import { setupPostHandler } from './v1/setup/post';
import { createSheetRoute } from './v1/sheets/route';
import { sheetsPostHandler } from './v1/sheets/post';
import storagesRouter, { uploadFileRoute, deleteFileRoute } from './v1/storages/route';
import storagesPostHandler from './v1/storages/post';
import storagesDeleteHandler from './v1/storages/delete';
import authRouter from './v1/auth';
// TODO: Re-enable OpenAPI integration when type compatibility is fixed
// import { loginRoute, callbackRoute, logoutRoute, meRoute } from './v1/auth';
// import { loginHandler } from './v1/auth/login/get';
// import { callbackHandler } from './v1/auth/callback/get';
// import { logoutHandler } from './v1/auth/logout/post';
// import { meHandler } from './v1/auth/me/get';
import type { Env } from '@/types/env';

/**
 * API Router - Centralized routing for all API endpoints
 * Provides RESTful API structure with consistent error handling and OpenAPI support
 */
const api = new OpenAPIHono<{ Bindings: Env }>();

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

// API versioning prefix
const v1 = new Hono<{ Bindings: Env }>();

// Health routes - direct OpenAPI mount
api.openapi(healthRoute, healthHandler);

// Setup routes - direct OpenAPI mount
api.openapi(setupStatusRoute, setupGetHandler);
api.openapi(setupConfigRoute, setupPostHandler);

// Sheets routes - direct OpenAPI mount
api.openapi(createSheetRoute, sheetsPostHandler);

// Storage routes - direct OpenAPI mount
api.openapi(uploadFileRoute, storagesPostHandler);
api.openapi(deleteFileRoute, storagesDeleteHandler);

// Auth routes - OpenAPI mount (temporarily disabled due to type mismatches)
// TODO: Fix type compatibility between handlers and OpenAPI schemas
// api.openapi(loginRoute, loginHandler);
// api.openapi(callbackRoute, callbackHandler);
// api.openapi(logoutRoute, logoutHandler);
// api.openapi(meRoute, meHandler);

// Storage routes - backwards compatibility
v1.route('/storages', storagesRouter);

// Auth routes - backwards compatibility
v1.route('/auth', authRouter);

// Mount v1 API routes
api.route('/v1', v1);

// OpenAPI documentation routes - auto-generated from api router
api.doc('/v1/doc', {
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