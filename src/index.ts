import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createErrorHandler, createNotFoundHandler } from './lib/error-handlers';
import { healthHandler } from './api/health/get';
import { setupHandler } from './setup';
import { playgroundHandler } from './playground';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Error handlers
app.onError(createErrorHandler());
app.notFound(createNotFoundHandler());

// Middleware
app.use(cors());
app.use(logger());

// Root path handler
app.get('/', async (c) => {
  // TODO: Check if setup is completed from D1 database
  const isSetupCompleted = false;
  
  if (!isSetupCompleted) {
    return c.redirect('/setup');
  }
  
  return c.redirect('/playground');
});

// Route handlers
app.get('/health', healthHandler);
app.get('/setup', setupHandler);
app.get('/playground', playgroundHandler);


// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};