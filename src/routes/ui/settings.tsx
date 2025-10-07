/**
 * System settings page route
 *
 * Serves HTML for system configuration interface.
 * Settings component will be implemented in Task 2.2.
 */

import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { Layout } from '../../components/Layout';

const settings = new Hono<{ Bindings: Env }>();

/**
 * GET /settings - System settings page
 *
 * Displays placeholder content for system settings.
 * Full implementation will be completed in Task 2.2.
 */
settings.get('/', (c) => {
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
              ℹ️ <strong>Coming Soon</strong>: System settings configuration will be
              implemented in Task 2.2.
            </p>
          </div>

          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
            This page will allow you to configure:
          </p>
          <ul style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>
            <li>Google API client credentials</li>
            <li>Maximum file upload size</li>
            <li>Default cache TTL</li>
            <li>Rate limiting configuration</li>
            <li>System-wide parameters</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
});

export default settings;
