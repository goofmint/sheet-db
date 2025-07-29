import { Hono } from 'hono';
import loginRoute from './login/get';
import callbackRoute from './callback/get';
import logoutRoute from './logout/post';
import meRoute from './me/get';
import { Env } from '@/types/env';

const app = new Hono<{ Bindings: Env }>();

app.route('/login', loginRoute);
app.route('/callback', callbackRoute);
app.route('/logout', logoutRoute);
app.route('/me', meRoute);

export default app;