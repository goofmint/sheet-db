import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthHandler } from './v1/health/get';
import { setupGetHandler } from './v1/setup/get';
import type { Env } from '../types';

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

// Health check endpoint
v1.get('/health', healthHandler);

// Setup endpoints
v1.get('/setup', setupGetHandler);
// v1.post('/setup', setupPostHandler); // TODO: Implement POST handler

// Playground endpoint (to be implemented)  
// v1.get('/playground', playgroundGetHandler);

// Future endpoints for Google Sheets integration
// v1.route('/sheets', sheetsRouter);

// Mount v1 API routes
api.route('/v1', v1);

// API root endpoint - provides API information
api.get('/', async (c) => {
  return c.json({
    name: 'Sheet DB API',
    version: '1.0.0',
    description: 'Backend-as-a-Service using Google Sheets as database',
    timestamp: new Date().toISOString(),
  });
});


export { api };
export default api;