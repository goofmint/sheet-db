import { Hono } from 'hono';
import healthRoute from './health';
import type { Env } from '../../types/env';

const api = new Hono<{ Bindings: Env }>();

// Health check endpoint
api.route('/health', healthRoute);

export default api;
