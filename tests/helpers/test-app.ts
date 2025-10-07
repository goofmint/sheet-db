/**
 * Test application helper
 *
 * Provides a properly configured Hono app instance for testing
 * with mock environment variables.
 */

import type { Env } from '../../src/types/env';

/**
 * Create a test Env object with default values
 *
 * This provides a mock environment that can be passed to Hono context
 * during testing, preventing undefined access errors.
 *
 * Usage with app.request():
 * ```typescript
 * const env = createTestEnv();
 * const res = await app.request('/api/health', {}, env);
 * ```
 */
export function createTestEnv(overrides?: Partial<Env>): Env {
  const defaultEnv: Env = {
    ENVIRONMENT: 'test',
    // Add other required environment variables here as they are added to the Env type
  };

  return {
    ...defaultEnv,
    ...overrides,
  };
}
