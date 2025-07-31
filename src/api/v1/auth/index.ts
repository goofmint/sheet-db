import { Hono } from 'hono';
import loginHandler from './login/get';
import callbackHandler from './callback/get';
import logoutHandler from './logout/post';
import meHandler from './me/get';
import { Env } from '@/types/env';
import { loginRoute, callbackRoute, logoutRoute, meRoute } from './route';

// Traditional Hono router for backwards compatibility
const authRouter = new Hono<{ Bindings: Env }>();

// GET /api/v1/auth/login - OAuth login initialization
authRouter.route('/login', loginHandler);

// GET /api/v1/auth/callback - OAuth callback handler
authRouter.route('/callback', callbackHandler);

// POST /api/v1/auth/logout - End user session
authRouter.route('/logout', logoutHandler);

// GET /api/v1/auth/me - Get current user
authRouter.route('/me', meHandler);

export default authRouter;

// Export OpenAPI route definitions for integration
export { loginRoute, callbackRoute, logoutRoute, meRoute };