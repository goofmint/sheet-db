// Test environment type declarations

// Cloudflare test environment module - provides access to test environment bindings
// This module is used by Vitest with @cloudflare/vitest-pool-workers to access 
// D1 database and other Cloudflare Workers bindings during testing
declare module 'cloudflare:test' {
  import type { Env } from '../src/types/env';
  export const env: Env;
}