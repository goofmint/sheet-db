/**
 * Initial setup page route
 *
 * Serves HTML for Google Sheets connection and configuration.
 * Setup component will be implemented in Task 2.1.
 */

import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { Layout } from '../../components/Layout';

const setup = new Hono<{ Bindings: Env }>();

/**
 * GET /setup - Initial setup page
 *
 * Displays placeholder content for initial setup wizard.
 * Full implementation will be completed in Task 2.1.
 */
setup.get('/', (c) => {
  const environment = c.env.ENVIRONMENT || 'development';

  return c.html(
    <Layout
      title="Initial Setup - Sheet DB Admin"
      environment={environment}
      currentPath="/setup"
    >
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
          Initial Setup
        </h1>
        <p style={{ color: '#6b7280', margin: '0 0 32px 0' }}>
          Connect to Google Sheets and configure your backend
        </p>

        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb',
          }}
        >
          <div
            style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #3b82f6',
              borderRadius: '6px',
              padding: '16px',
              marginBottom: '16px',
            }}
          >
            <p style={{ margin: 0, color: '#1e40af', fontSize: '14px' }}>
              ℹ️ <strong>Coming Soon</strong>: Initial setup wizard will be
              implemented in Task 2.1.
            </p>
          </div>

          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
            The setup wizard will guide you through:
          </p>
          <ul style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>
            <li>Google OAuth2 authentication</li>
            <li>Google Sheets selection</li>
            <li>Sheet structure validation</li>
            <li>Initial configuration</li>
            <li>Permission setup</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
});

export default setup;
