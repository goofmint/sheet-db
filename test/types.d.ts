// Test environment type declarations

declare module 'cloudflare:test' {
  import type { Env } from '../src/types/env';
  export const env: Env;
}