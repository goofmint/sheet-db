/**
 * CORS middleware for API routes
 *
 * Configures Cross-Origin Resource Sharing headers to allow requests
 * from any origin. This is appropriate for a BaaS (Backend as a Service)
 * architecture where the API is consumed by various client applications.
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../types/env';

/**
 * CORS middleware options
 */
interface CorsOptions {
  origin: string | string[];
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
}

/**
 * Create CORS middleware with specified options
 *
 * @param options - CORS configuration options
 * @returns Hono middleware for CORS handling
 *
 * Implementation details:
 * - Sets Access-Control-Allow-Origin header
 * - Handles preflight OPTIONS requests
 * - Configures allowed methods and headers
 * - No credentials flag (incompatible with origin: '*')
 */
export function cors(options: CorsOptions) {
  const {
    origin,
    allowMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders = ['Content-Type', 'Authorization'],
    exposeHeaders = [],
    maxAge = 86400,
  } = options;

  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    // Determine which origin to use in response
    let responseOrigin: string;
    if (Array.isArray(origin)) {
      // For multiple origins, check against list
      const requestOrigin = c.req.header('Origin');
      if (requestOrigin && origin.includes(requestOrigin)) {
        responseOrigin = requestOrigin;
      } else {
        // If origin not in list, don't set CORS headers
        if (c.req.method !== 'OPTIONS') {
          await next();
          return;
        }
        // For OPTIONS, still need to respond but without CORS headers
        return c.body(null, 204);
      }
    } else {
      // Single origin or wildcard
      responseOrigin = origin;
    }

    // Set CORS headers
    c.header('Access-Control-Allow-Origin', responseOrigin);
    if (responseOrigin !== '*') {
      c.header('Vary', 'Origin');
    }
    c.header('Access-Control-Allow-Methods', allowMethods.join(', '));
    c.header('Access-Control-Allow-Headers', allowHeaders.join(', '));

    if (exposeHeaders.length > 0) {
      c.header('Access-Control-Expose-Headers', exposeHeaders.join(', '));
    }

    c.header('Access-Control-Max-Age', maxAge.toString());

    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204);
    }

    await next();
  });
}

/**
 * Default CORS configuration
 *
 * No restrictions as this is a BaaS (Backend as a Service).
 * Allows all origins without credentials flag.
 */
export const defaultCors = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
});
