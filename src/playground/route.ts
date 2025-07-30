import { Hono } from 'hono';
import { playgroundGetHandler } from './get';
import type { Env } from '@/types/env';

/**
 * Playground routes
 * Provides API testing interface (moved from /api/v1/playground to /playground)
 */
const playgroundRouter = new Hono<{ Bindings: Env }>();

// GET /playground - Show API playground
playgroundRouter.get('/', playgroundGetHandler);

export default playgroundRouter;