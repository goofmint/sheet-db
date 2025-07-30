import { Hono } from 'hono';
import configGet from './get';
import configAuth from './auth';
import configLogout from './logout';
import { Env } from '@/types/env';

const app = new Hono<{ Bindings: Env }>();

app.route('/', configGet);
app.route('/auth', configAuth);
app.route('/logout', configLogout);

export default app;