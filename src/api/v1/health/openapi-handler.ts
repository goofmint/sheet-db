import type { Context } from 'hono';
import type { Env } from '@/types/env';

/**
 * OpenAPI-compatible health handler
 * Returns strictly typed responses matching OpenAPI schema
 */
export const healthOpenAPIHandler = (c: Context<{ Bindings: Env }>) => {
  try {
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'sheetDB',
      version: '1.0.0'
    }, 200);
  } catch (error) {
    console.error('Health check error:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Health check failed'
    }, 500);
  }
};