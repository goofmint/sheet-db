import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { drizzle } from 'drizzle-orm/d1';
import { createErrorHandler, createNotFoundHandler } from './lib/error-handlers';
import { ConfigService } from './services/config';
import { api } from './api';
import { setupHandler } from './setup';
import { playgroundHandler } from './playground';
import { googleCallbackHandler } from './google/callback/get';
import configRouter from './api/v1/config';
import { sheetInitializeHandler } from './sheet/initialize/get';
import { sheetSelectHandler } from './sheet/select/get';
import type { Env } from './types/env';

const app = new Hono<{ Bindings: Env }>();

// ConfigService initialization middleware
app.use('*', async (c, next) => {
  // Initialize ConfigService if not already done
  if (!ConfigService.isInitialized()) {
    const db = drizzle(c.env.DB);
    await ConfigService.initialize(db);
  }
  
  await next();
});

// Error handlers
app.onError(createErrorHandler());
app.notFound(createNotFoundHandler());

// Middleware
app.use(cors());
app.use(logger());

// Root path handler
app.get('/', async (c) => {
  // Check if setup is completed using ConfigService
  const isSetupCompleted = ConfigService.getBoolean('app.setup_completed', false);
  
  if (!isSetupCompleted) {
    return c.redirect('/setup');
  }
  
  return c.redirect('/playground');
});

// API routes
app.route('/api', api);

// Google OAuth routes
app.get('/google/callback', googleCallbackHandler);

// Sheet configuration routes
app.get('/sheet/select', sheetSelectHandler);
app.post('/sheet/select', sheetSelectHandler);
app.get('/sheet/initialize', sheetInitializeHandler);
app.post('/sheet/initialize', sheetInitializeHandler);

// Non-API routes
app.get('/setup', setupHandler);
app.get('/playground', playgroundHandler);

// Config management routes
app.route('/config', configRouter);


// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};