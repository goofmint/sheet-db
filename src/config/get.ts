import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { Env } from '@/types/env';
import {
  generateCSRFToken,
  setCSRFCookie
} from '@/utils/security';
import { LoginForm } from '../templates/config/login';
import { ErrorPage } from '../templates/error-page';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  try {
    // Initialize ConfigService
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }

    // Generate CSRF token
    const csrfToken = generateCSRFToken();
    setCSRFCookie(c, csrfToken);

    // Always show password input form - authentication happens client-side
    return c.html(LoginForm({ csrfToken }));

  } catch (error) {
    console.error('Config page error:', error);
    return c.html(ErrorPage({
      title: 'Error - Configuration Management',
      heading: 'Configuration Error',
      message: 'An error occurred while loading the configuration page.',
      backLink: {
        url: '/playground',
        text: '← Back to Playground'
      }
    }), 500);
  }
});




export default app;