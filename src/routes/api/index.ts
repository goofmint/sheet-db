/**
 * API routes aggregator
 *
 * Combines all API endpoints into a single router.
 */

import { Hono } from 'hono';
import healthRoute from './health';
import versionRoute from './version';
import setupRoute from '../setup';
import settingsRoute from './settings';
import authRoute from './auth';
import type { Env } from '../../types/env';

const api = new Hono<{ Bindings: Env }>();

/**
 * API endpoint routes
 *
 * - /health: Service health check with database status
 * - /version: Application version information
 * - /setup: Initial setup endpoints (Google OAuth, sheet selection, etc.)
 * - /settings: System settings management (requires Administrator role)
 * - /auth: Authentication endpoints (login, logout, session info)
 */
api.route('/health', healthRoute);
api.route('/version', versionRoute);
api.route('/setup', setupRoute);
api.route('/settings', settingsRoute);
api.route('/auth', authRoute);

export default api;
