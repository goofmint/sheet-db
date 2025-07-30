import { Hono } from 'hono';
import { playgroundGetHandler } from './get';
import type { Env } from '@/types/env';

/**
 * Playground routes
 * Provides API testing interface
 */
const playgroundRouter = new Hono<{ Bindings: Env }>();

// GET /api/v1/playground - Show API playground
playgroundRouter.get('/', playgroundGetHandler);

export default playgroundRouter;