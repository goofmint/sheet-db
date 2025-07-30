import { Hono } from 'hono';
import { Env } from '@/types/env';
import { clearSessionCookie, verifyCSRFToken, getCSRFToken } from '@/utils/security';

const app = new Hono<{ Bindings: Env }>();

app.post('/', async (c) => {
  try {
    // Get form data
    const formData = await c.req.formData();
    const csrfToken = formData.get('csrf_token')?.toString() || '';

    // Verify CSRF token
    const storedCSRFToken = getCSRFToken(c);
    if (!storedCSRFToken || !verifyCSRFToken(csrfToken, storedCSRFToken)) {
      return c.redirect('/config?error=invalid_csrf');
    }

    // Clear session cookies
    clearSessionCookie(c);

    // Redirect to config page (will show login form)
    return c.redirect('/config');

  } catch (error) {
    console.error('Config logout error:', error);
    return c.redirect('/config');
  }
});

export default app;