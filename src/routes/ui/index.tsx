/**
 * Main UI router that aggregates all UI page routes
 *
 * Combines dashboard, settings, and setup pages into a single router.
 */

import { Hono } from 'hono';
import type { Env } from '../../types/env';
import dashboardRoutes from './dashboard';
import settingsRoutes from './settings';
import setupRoutes from './setup';

const ui = new Hono<{ Bindings: Env }>();

/**
 * Aggregate all UI routes
 *
 * Route mapping:
 * - / -> Dashboard page
 * - /settings -> System settings page
 * - /setup -> Initial setup page
 */
ui.route('/', dashboardRoutes);
ui.route('/settings', settingsRoutes);
ui.route('/setup', setupRoutes);

export default ui;
