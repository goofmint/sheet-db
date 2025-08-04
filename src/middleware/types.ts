import type { Context } from 'hono';
import type { AuthContext } from './auth';

/**
 * Extended Hono context with authentication
 */
export interface AuthenticatedContext extends Context {
  get(key: 'auth'): AuthContext;
}

