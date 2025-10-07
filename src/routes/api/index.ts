/**
 * API routes aggregator
 *
 * Combines all API endpoints into a single router.
 */

import { Hono } from 'hono';
import healthRoute from './health';
import versionRoute from './version';
import type { Env } from '../../types/env';

const api = new Hono<{ Bindings: Env }>();

/**
 * API endpoint routes
 *
 * - /health: Service health check with database status
 * - /version: Application version information
 */
api.route('/health', healthRoute);
api.route('/version', versionRoute);

export default api;
