import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { Env } from '@/types/env';
import {
  createSessionToken,
  setSessionCookie,
  verifyCSRFToken,
  getCSRFToken,
  generateCSRFToken,
  setCSRFCookie,
  timingSafeEquals
} from '@/utils/security';

const app = new Hono<{ Bindings: Env }>();

// Password authentication
app.post('/', async (c) => {
  try {
    // Initialize ConfigService
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }

    // Extract form data
    let password: string;
    let csrfToken: string;
    
    try {
      const body = await c.req.parseBody();
      password = body.password as string;
      csrfToken = body.csrf_token as string;
    } catch {
      const formData = await c.req.formData();
      password = formData.get('password') as string;
      csrfToken = formData.get('csrf_token') as string;
    }

    // Validate CSRF token first
    const storedCSRFToken = getCSRFToken(c);
    if (!csrfToken || !storedCSRFToken || !verifyCSRFToken(csrfToken, storedCSRFToken)) {
      return c.redirect('/config?error=csrf_invalid');
    }

    if (!password) {
      return c.redirect('/config?error=password_required');
    }

    // Get configuration password
    const configPassword = ConfigService.getString('app.config_password');
    
    if (!configPassword) {
      return c.redirect('/config?error=config_not_found');
    }

    // Password verification (constant-time comparison)
    const isValid = await timingSafeEquals(password, configPassword);
    
    if (!isValid) {
      // Timing attack protection: wait for a fixed duration
      await new Promise(resolve => setTimeout(resolve, 100));
      return c.redirect('/config?error=invalid_password');
    }

    // Authentication successful: create secure session token
    const sessionToken = await createSessionToken(configPassword);
    setSessionCookie(c, sessionToken);

    // Generate and set new CSRF token for authenticated session
    const newCSRFToken = generateCSRFToken();
    setCSRFCookie(c, newCSRFToken);

    return c.redirect('/config');

  } catch (error) {
    console.error('Config auth error:', error);
    return c.redirect('/config?error=server_error');
  }
});


export default app;