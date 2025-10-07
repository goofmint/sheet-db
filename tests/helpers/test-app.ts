/**
 * Test application helper
 *
 * Provides a properly configured test environment using real D1 database.
 * NO MOCKING - uses Wrangler's getPlatformProxy for actual D1 access.
 */

import { getPlatformProxy } from 'wrangler';
import type { Env } from '../../src/types/env';

let cachedEnv: Env | null = null;
let cachedCleanup: (() => Promise<void>) | null = null;

/**
 * Get test environment with real D1 database
 *
 * Uses Wrangler's getPlatformProxy to access actual D1 database in local mode.
 * NO MOCKING - this follows strict project requirements.
 *
 * The environment is cached to avoid recreating the proxy on every test.
 *
 * Usage with app.request():
 * ```typescript
 * const env = await getTestEnv();
 * const res = await app.request('/api/health', {}, env);
 * ```
 */
export async function getTestEnv(): Promise<Env> {
  if (cachedEnv) {
    return cachedEnv;
  }

  const proxy = await getPlatformProxy<Env>();
  cachedEnv = proxy.env;
  cachedCleanup = proxy.dispose;

  return cachedEnv;
}

/**
 * Cleanup test environment
 *
 * Should be called after all tests complete to dispose of the platform proxy.
 */
export async function cleanupTestEnv(): Promise<void> {
  if (cachedCleanup) {
    await cachedCleanup();
    cachedEnv = null;
    cachedCleanup = null;
  }
}
