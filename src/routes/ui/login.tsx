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
  const error = c.req.query('error');

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '80vh',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '40px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb',
            width: '100%',
            maxWidth: '400px',
          }}
        >
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              margin: '0 0 8px 0',
              textAlign: 'center',
            }}
          >
            Sign In
          </h1>
          <p
            style={{
              color: '#6b7280',
              margin: '0 0 32px 0',
              textAlign: 'center',
            }}
          >
            Enter your credentials to access the system
          </p>

          {error && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '24px',
                color: '#991b1b',
              }}
            >
              {error === 'invalid' && 'Invalid username or password'}
              {error === 'unauthorized' && 'Authentication required'}
              {error === 'forbidden' &&
                'Administrator role required for this operation'}
            </div>
          )}

          <form id="login-form" method="post" action="/api/auth/login">
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="username"
                style={{
                  display: 'block',
                  fontWeight: '500',
                  marginBottom: '6px',
                  fontSize: '14px',
                }}
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                required
                autoComplete="username"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontWeight: '500',
                  marginBottom: '6px',
                  fontSize: '14px',
                }}
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '12px',
                borderRadius: '6px',
                border: 'none',
                fontWeight: '600',
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Sign In
            </button>
          </form>

          {raw(`
            <script>
              const form = document.getElementById('login-form');
              form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const formData = new FormData(form);
                const username = formData.get('username');
                const password = formData.get('password');

                try {
                  const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                  });

                  if (response.ok) {
                    const data = await response.json();
                    // Redirect to intended page or settings
                    const redirectParam = new URLSearchParams(window.location.search).get('redirect');
                    const redirectTo =
                      redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
                        ? redirectParam
                        : '/settings';
                    window.location.href = redirectTo;
                  } else {
                    // Show error
                    window.location.href = '/login?error=invalid';
                  }
                } catch (error) {
                  console.error('Login failed:', error);
                  window.location.href = '/login?error=invalid';
                }
              });
            </script>
          `)}
        </div>
      </div>
    </Layout>
  );
});

export default login;
