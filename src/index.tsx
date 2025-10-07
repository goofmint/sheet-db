import { Hono } from 'hono';
import { renderer } from './middlewares/renderer';
import { errorHandler } from './middlewares/error';
import apiRoutes from './routes/api';
import type { Env } from './types/env';

const app = new Hono<{ Bindings: Env }>();

// Error handling middleware
app.use('*', errorHandler);

// Renderer middleware for frontend
app.use('*', renderer);

// API routes
app.route('/api', apiRoutes);

// Frontend routes
app.get('/', (c) => {
  return c.render(
    <div>
      <h1>Sheet DB Admin Dashboard</h1>
      <p>Welcome to the admin panel</p>
    </div>
  );
});

export default app;
