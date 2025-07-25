// Cloudflare Workers environment bindings
export interface Env {
  // D1 Database
  DB: D1Database;
  
  // R2 Storage bucket
  R2_BUCKET: R2Bucket;
  
  // Environment variables
  ENVIRONMENT: 'development' | 'production';
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  
  // Auth0 configuration (loaded from Config table or env vars)
  AUTH0_DOMAIN?: string;
  AUTH0_CLIENT_ID?: string;
  AUTH0_CLIENT_SECRET?: string;
  
  // Google OAuth configuration (loaded from Config table or env vars)
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  
  // Master key for administrative access
  MASTER_KEY?: string;
}