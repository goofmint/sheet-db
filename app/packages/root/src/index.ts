import { Hono } from 'hono';

const app = new Hono()
  .get('/', (c) => {
    return c.json({ name: 'app', status: 'running' });
  })
  .get('/health', (c) => {
    return c.json({ status: 'healthy' });
  });

export type RootApp = typeof app;
export default app;
