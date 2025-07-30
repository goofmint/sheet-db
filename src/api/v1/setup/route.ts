import { Hono } from 'hono';
import { setupGetHandler } from './get';
import { setupPostHandler } from './post';
import type { Env } from '@/types/env';

/**
 * Setup routes
 * Handles initial application configuration
 */
const setupRouter = new Hono<{ Bindings: Env }>();

// GET /api/v1/setup - Get setup status
setupRouter.get('/', setupGetHandler);

// POST /api/v1/setup - Submit setup configuration
setupRouter.post('/', setupPostHandler);

export default setupRouter;