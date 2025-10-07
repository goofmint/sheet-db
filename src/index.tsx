/**
 * Main application entry point
 *
 * Configures middleware, routes, and exports the Hono application.
 * This application serves both API endpoints and UI pages.
 */

import { Hono } from 'hono';
import { renderer } from './middlewares/renderer';
import { errorHandler } from './middlewares/error';
import { defaultCors } from './middlewares/cors';
import apiRoutes from './routes/api';
import uiRoutes from './routes/ui';
import type { Env } from './types/env';

const app = new Hono<{ Bindings: Env }>();

/**
 * Global middleware configuration
 *
 * Middleware order is critical:
 * 1. Error handler - Catches and formats all errors
 * 2. CORS - Handles cross-origin requests (BaaS architecture)
 * 3. Renderer - Provides JSX rendering capability
 *
 * CORS is configured to allow all origins (*) since this is a BaaS.
 * No credentials flag is set as we allow all origins for maximum compatibility.
 */
app.use('*', errorHandler);
app.use('*', defaultCors);
app.use('*', renderer);

/**
 * Route configuration
 *
 * - /api/* - API endpoints (health, version, etc.)
 * - /* - UI pages (dashboard, settings, setup)
 *
 * UI routes are mounted at root to provide clean URLs for pages.
 */
app.route('/api', apiRoutes);
app.route('/', uiRoutes);

export default app;
