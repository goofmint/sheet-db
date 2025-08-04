import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { Env } from '@/types/env';
import {
  isAuthenticated,
  generateCSRFToken,
  setCSRFCookie,
  getCSRFToken
} from '@/utils/security';
import { ConfigForm } from '../templates/config/form';
import { LoginForm } from '../templates/config/login';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  try {
    // Initialize ConfigService
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }

    // Check authentication using secure session token
    const configPassword = ConfigService.getString('app.config_password');
    const authenticated = await isAuthenticated(c, configPassword);

    if (!authenticated) {
      // Generate CSRF token for the login form
      const csrfToken = generateCSRFToken();
      setCSRFCookie(c, csrfToken);

      // Unauthenticated: password input form
      return c.html(LoginForm({ csrfToken }));
    }

    // Authenticated: display configuration list
    // Use existing CSRF token if available, otherwise generate new one
    let csrfToken = getCSRFToken(c);
    if (!csrfToken) {
      csrfToken = generateCSRFToken();
      setCSRFCookie(c, csrfToken);
    }
    
    // Empty config list - data will be loaded via JavaScript
    const configList: never[] = [];

    return c.html(ConfigForm({ configList, csrfToken }));

  } catch (error) {
    console.error('Config page error:', error);
    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Error - Configuration Management</title>
      </head>
      <body>
        <h1>An Error Occurred</h1>
        <p>An error occurred while loading the configuration.</p>
        <a href="/playground">Back to Playground</a>
      </body>
      </html>
    `, 500);
  }
});




export default app;