import { Hono } from 'hono';
import { cors } from 'hono/cors';
import healthRouter from './v1/health/route';
import setupRouter from './v1/setup/route';
import sheetsRouter from './v1/sheets/route';
import playgroundRouter from './v1/playground/route';
import storagesRouter from './v1/storages/route';
import authRouter from './v1/auth';
import { openapi } from './openapi';
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

// API versioning prefix
const v1 = new Hono<{ Bindings: Env }>();

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
api.route('/v1', openapi);

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