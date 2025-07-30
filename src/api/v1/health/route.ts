import { Hono } from 'hono';
import { healthHandler } from './get';
import type { Env } from '@/types/env';

/**
 * Health routes
 * System health check endpoints
 */
const healthRouter = new Hono<{ Bindings: Env }>();

// GET /api/v1/health - Check API health status
healthRouter.get('/', healthHandler);

export default healthRouter;