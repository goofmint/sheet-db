/**
 * System Settings Page
 *
 * Provides UI for managing system configuration settings
 * Dynamically displays settings based on definitions
 * Requires Administrator role
 */

import { Hono } from 'hono';
import type { Env, ContextVariables } from '../../types/env';
import { Layout } from '../../components/Layout';
import { raw } from 'hono/html';
import { requireAuth, requireAdministrator } from '../../middleware/auth';

const settings = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

/**
 * GET /settings - System settings page
 * Displays configuration interface for system administrators
 * Requires authentication and Administrator role
 */
settings.get('/', requireAuth, requireAdministrator, (c) => {
  const environment = c.env.ENVIRONMENT || 'development';

  return c.html(
    <Layout
      title="System Settings - Sheet DB Admin"
      environment={environment}
      currentPath="/settings"
    >
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
          System Settings
        </h1>
        <p style={{ color: '#6b7280', margin: '0 0 32px 0' }}>
          Configure system-wide settings
        </p>

        {raw(`
          <div id="app"></div>
          <script type="module" src="/settings.js"></script>
        `)}
      </div>
    </Layout>
  );
});

export default settings;
