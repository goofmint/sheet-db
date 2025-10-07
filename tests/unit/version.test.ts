/**
 * Version API endpoint tests
 *
 * Tests the /api/version endpoint functionality including:
 * - Status code responses
 * - Response structure validation
 * - Version information format
 * - Build metadata
 */

import { describe, it, expect } from 'vitest';
import app from '../../src/index.tsx';
import { createTestEnv } from '../helpers/test-app';

describe('Version API', () => {
  const testEnv = createTestEnv();

  it('should return 200 status code', async () => {
    const res = await app.request('/api/version', {
      method: 'GET',
    }, testEnv);

    expect(res.status).toBe(200);
  });

  it('should return valid version response structure', async () => {
    const res = await app.request('/api/version', {}, testEnv);
    const data = await res.json();

    // Validate response structure
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('environment');
    expect(data).toHaveProperty('build');

    // Validate build object structure
    expect(data.build).toHaveProperty('timestamp');
    expect(data.build).toHaveProperty('nodeVersion');
  });

  it('should return semantic version format', async () => {
    const res = await app.request('/api/version', {}, testEnv);
    const data = await res.json();

    expect(data.version).toBeDefined();
    expect(typeof data.version).toBe('string');
    expect(data.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic versioning (X.Y.Z)
  });

  it('should return application name', async () => {
    const res = await app.request('/api/version', {}, testEnv);
    const data = await res.json();

    expect(data.name).toBeDefined();
    expect(typeof data.name).toBe('string');
    expect(data.name).toBe('sheet-db');
  });

  it('should return environment information', async () => {
    const res = await app.request('/api/version', {}, testEnv);
    const data = await res.json();

    expect(data.environment).toBeDefined();
    expect(typeof data.environment).toBe('string');
  });

  it('should return valid build timestamp in ISO 8601 format', async () => {
    const res = await app.request('/api/version', {}, testEnv);
    const data = await res.json();

    expect(data.build.timestamp).toBeDefined();

    // Validate ISO 8601 format
    const timestamp = new Date(data.build.timestamp);
    expect(timestamp.getTime()).toBeGreaterThan(0);
    expect(data.build.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should return node version information', async () => {
    const res = await app.request('/api/version', {}, testEnv);
    const data = await res.json();

    expect(data.build.nodeVersion).toBeDefined();
    expect(typeof data.build.nodeVersion).toBe('string');
  });

  it('should include CORS headers', async () => {
    const res = await app.request('/api/version', {
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
    const res = await app.request('/api/version', {
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
