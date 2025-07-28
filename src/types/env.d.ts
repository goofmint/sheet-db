import type { Fetcher } from '@cloudflare/workers-types';

// Cloudflare Workers environment bindings
export interface Env {
  // D1 Database
  DB: D1Database;
  
  // R2 Storage bucket (optional)
  R2_BUCKET?: R2Bucket;
  
  // Auth0 secrets
  AUTH0_CLIENT_SECRET: string;
  
  // Drizzle database connection (development only)
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_DATABASE_ID?: string;
  CLOUDFLARE_D1_TOKEN?: string;
  
  // Logging configuration
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
  
  // Assets
  ASSETS: Fetcher;
}

