import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { Env } from '@/types/env';
import { createSessionToken, setSessionCookie, verifyCSRFToken, getCSRFToken } from '@/utils/security';

const app = new Hono<{ Bindings: Env }>();

app.post('/', async (c) => {
  try {
    // Initialize ConfigService
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }

    // Get form data
    const formData = await c.req.formData();
    const password = formData.get('password')?.toString() || '';
    const csrfToken = formData.get('csrf_token')?.toString() || '';

    // Verify CSRF token
    const storedCSRFToken = getCSRFToken(c);
    if (!storedCSRFToken || !verifyCSRFToken(csrfToken, storedCSRFToken)) {
      return c.redirect('/config?error=invalid_csrf');
    }

    // Verify password
    const configPassword = ConfigService.getString('app.config_password');
    if (!configPassword || password !== configPassword) {
      return c.redirect('/config?error=invalid_password');
    }

    // Create secure session token and set cookies
    const sessionToken = await createSessionToken(configPassword);
    setSessionCookie(c, sessionToken);

    // Redirect to config page
    return c.redirect('/config');

  } catch (error) {
    console.error('Config auth error:', error);
    return c.redirect('/config?error=auth_failed');
  }
});

export default app;