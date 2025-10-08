/**
 * Main UI router that aggregates all UI page routes
 *
 * Combines dashboard, settings, setup, and login pages into a single router.
 */

import { Hono } from 'hono';
import type { Env } from '../../types/env';
import dashboardRoutes from './dashboard';
import settingsRoutes from './settings';
import setupRoutes from './setup';
import loginRoutes from './login';

const ui = new Hono<{ Bindings: Env }>();

/**
 * Aggregate all UI routes
 *
 * Route mapping:
 * - / -> Dashboard page
 * - /settings -> System settings page (requires Administrator role)
 * - /setup -> Initial setup page
 * - /login -> Login page
 */
ui.route('/', dashboardRoutes);
ui.route('/settings', settingsRoutes);
ui.route('/setup', setupRoutes);
ui.route('/login', loginRoutes);

export default ui;
