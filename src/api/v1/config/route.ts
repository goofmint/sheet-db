import { Hono } from 'hono';
import { validationRulesHandler } from './validation-rules';
import type { Env } from '../../../types';

const app = new Hono<{ Bindings: Env }>();

app.get('/validation-rules', validationRulesHandler);

export default app;