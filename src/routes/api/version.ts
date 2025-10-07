/**
 * Version information endpoint
 *
 * Returns application version and build information.
 */

import { Hono } from 'hono';
import type { Env } from '../../types/env';

const version = new Hono<{ Bindings: Env }>();

/**
 * Version response interface
 */
interface VersionResponse {
  version: string;
  name: string;
  environment: string;
  build: {
    timestamp: string;
    nodeVersion: string;
  };
}

/**
 * GET /api/version - Version information endpoint
 *
 * Returns application version from package.json and build metadata.
 * Useful for debugging and version verification in production.
 */
version.get('/', (c) => {
  const response: VersionResponse = {
    version: '0.1.0', // From package.json
    name: 'sheet-db',
    environment: c.env.ENVIRONMENT || 'development',
    build: {
      timestamp: new Date().toISOString(),
      nodeVersion: 'cloudflare-workers',
    },
  };

  return c.json(response);
});

export default version;
