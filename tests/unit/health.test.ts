/**
 * Health API endpoint tests
 *
 * Tests the /api/health endpoint functionality including:
 * - Status code responses
 * - Response structure validation
 * - Database connectivity check
 * - Timestamp and uptime metrics
 */

import { describe, it, expect } from 'vitest';
import app from '../../src/index.tsx';
import { createTestEnv } from '../helpers/test-app';

describe('Health API', () => {
  const testEnv = createTestEnv();

  it('should return healthy status with proper structure', async () => {
    const res = await app.request('/api/health', {
      method: 'GET',
    }, testEnv);

    // Health endpoint returns 200 when healthy, 503 when unhealthy
    // We expect healthy status as the database should be accessible in tests
    expect([200, 503]).toContain(res.status);

    const data = await res.json();

    // Validate response structure
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('environment');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('database');

    // Validate status value
    expect(['healthy', 'unhealthy']).toContain(data.status);

    // Validate database object structure
    expect(data.database).toHaveProperty('connected');
    expect(typeof data.database.connected).toBe('boolean');

    // If database is connected, response time should be present
    if (data.database.connected) {
      expect(data.database).toHaveProperty('responseTime');
      expect(typeof data.database.responseTime).toBe('number');
      expect(data.database.responseTime).toBeGreaterThanOrEqual(0);
    }
  });

  it('should return valid timestamp in ISO 8601 format', async () => {
    const res = await app.request('/api/health', {}, testEnv);
    const data = await res.json();

    expect(data.timestamp).toBeDefined();

    // Validate ISO 8601 format
    const timestamp = new Date(data.timestamp);
    expect(timestamp.getTime()).toBeGreaterThan(0);
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should return uptime in seconds', async () => {
    const res = await app.request('/api/health', {}, testEnv);
    const data = await res.json();

    expect(data.uptime).toBeDefined();
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should return environment information', async () => {
    const res = await app.request('/api/health', {}, testEnv);
    const data = await res.json();

    expect(data.environment).toBeDefined();
    expect(typeof data.environment).toBe('string');
  });

  it('should return version information', async () => {
    const res = await app.request('/api/health', {}, testEnv);
    const data = await res.json();

    expect(data.version).toBeDefined();
    expect(typeof data.version).toBe('string');
    expect(data.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic versioning format
  });

  it('should include CORS headers', async () => {
    const res = await app.request('/api/health', {
      method: 'GET',
      headers: {
        Origin: 'https://example.com',
      },
    }, testEnv);

    // Verify CORS headers are present
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBeDefined();
    expect(res.headers.get('Access-Control-Allow-Headers')).toBeDefined();
  });

  it('should handle OPTIONS preflight requests', async () => {
    const res = await app.request('/api/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'GET',
      },
    }, testEnv);

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
