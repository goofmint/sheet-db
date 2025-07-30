import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { Env } from '@/types/env';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  // Delete authentication cookie
  deleteCookie(c, 'config_auth', {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    path: '/'
  });

  return c.redirect('/config');
});

export default app;