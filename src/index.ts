import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { healthHandler } from './api/health/get';
import { setupHandler } from './setup';
import { playgroundHandler } from './playground';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Error handlers
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({
      error: {
        code: `HTTP_${err.status}`,
        message: err.message,
        timestamp: new Date().toISOString()
      }
    }, err.status);
  }

  console.error('Internal server error:', err);
  
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    }
  }, 500);
});

app.notFound((c) => {
  return c.json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      path: c.req.path,
      timestamp: new Date().toISOString()
    }
  }, 404);
});

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