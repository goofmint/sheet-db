/**
 * Health check endpoint
 *
 * Provides service health status, environment information,
 * and database connectivity check.
 */

import { Hono } from 'hono';
import { createDbClient } from '../../db/client';
import type { Env } from '../../types/env';

const health = new Hono<{ Bindings: Env }>();

/**
 * Health check response interface
 */
interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  environment: string;
  version: string;
  uptime: number;
  database: {
    connected: boolean;
    responseTime?: number;
  };
}

// Track service start time for uptime calculation
const startTime = Date.now();

/**
 * GET /api/health - Health check endpoint
 *
 * Returns comprehensive health status including:
 * - Service status
 * - Environment information
 * - Database connection status with response time
 * - Service uptime
 *
 * Used for monitoring and load balancer health checks.
 */
health.get('/', async (c) => {
  // Check database connectivity
  let dbConnected = false;
  let dbResponseTime: number | undefined;

  try {
    const db = createDbClient(c.env);
    const dbStartTime = Date.now();

    // Simple query to test database connection
    await db.select().from((await import('../../db/schema')).config).limit(1);

    dbConnected = true;
    dbResponseTime = Date.now() - dbStartTime;
  } catch {
    // Database connection failed
    dbConnected = false;
  }

  // Calculate service uptime in seconds
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  const response: HealthResponse = {
    status: dbConnected ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'development',
    version: '0.1.0', // From package.json
    uptime,
    database: {
      connected: dbConnected,
      responseTime: dbResponseTime,
    },
  };

  // Return 503 if unhealthy, 200 if healthy
  const statusCode = dbConnected ? 200 : 503;

  return c.json(response, statusCode);
});

export default health;
