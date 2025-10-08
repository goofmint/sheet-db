/**
 * Login Page
 * Provides authentication interface for users
 */

import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { Layout } from '../../components/Layout';
import { raw } from 'hono/html';

const login = new Hono<{ Bindings: Env }>();

/**
 * GET /login - Login page
 */
login.get('/', async (c) => {
  const environment = c.env.ENVIRONMENT || 'development';

  // Check if setup is completed
  const { ConfigRepository } = await import('../../db/config.repository');
  const configRepo = new ConfigRepository(c.env);
  const isSetupComplete = await configRepo.isSetupComplete();

  // Redirect to setup if not completed
  if (!isSetupComplete) {
    return c.redirect('/setup');
  }

  return c.html(
    <Layout
      title="Login - Sheet DB"
      environment={environment}
      currentPath="/login"
    >
      {raw(`
        <div id="app"></div>
        <script type="module" src="/login.js"></script>
      `)}
    </Layout>
  );
});

export default login;
