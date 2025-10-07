/**
 * Dashboard page route - main admin panel view
 *
 * Serves HTML with Dashboard component using server-side rendering.
 */

import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { Layout } from '../../components/Layout';
import { Dashboard } from '../../components/Dashboard';

const dashboard = new Hono<{ Bindings: Env }>();

/**
 * GET / - Dashboard page
 *
 * Renders the main dashboard with system overview cards and quick actions.
 * Uses server-side rendering with Hono JSX.
 */
dashboard.get('/', (c) => {
  const environment = c.env.ENVIRONMENT || 'development';

  return c.html(
    <Layout
      title="Dashboard - Sheet DB Admin"
      environment={environment}
      currentPath="/"
    >
      <Dashboard />
    </Layout>
  );
});

export default dashboard;
