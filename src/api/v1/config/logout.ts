import { Hono } from 'hono';
import { Env } from '@/types/env';
import { clearAuthCookies } from '@/utils/security';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  // Clear all authentication and CSRF cookies
  clearAuthCookies(c);

  return c.redirect('/config');
});

export default app;