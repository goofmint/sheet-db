/**
 * CORS middleware tests
 *
 * Tests CORS middleware functionality including:
 * - Wildcard origin handling
 * - Specific origin handling
 * - Preflight requests
 * - Headers configuration
 * - Max age settings
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { cors } from '../../src/middlewares/cors';
import type { Env } from '../../src/types/env';

describe('CORS Middleware', () => {
  describe('Wildcard origin (*)', () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', cors({ origin: '*' }));
    app.get('/test', (c) => c.json({ success: true }));

    it('should allow any origin with wildcard', async () => {
      const res = await app.request('/test', {
        headers: {
          Origin: 'https://example.com',
        },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should include default allowed methods', async () => {
      const res = await app.request('/test', {
        headers: {
          Origin: 'https://example.com',
        },
      });

      const methods = res.headers.get('Access-Control-Allow-Methods');
      expect(methods).toBeDefined();
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
      expect(methods).toContain('OPTIONS');
    });

    it('should include default allowed headers', async () => {
      const res = await app.request('/test', {
        headers: {
          Origin: 'https://example.com',
        },
      });

      const headers = res.headers.get('Access-Control-Allow-Headers');
      expect(headers).toBeDefined();
      expect(headers).toContain('Content-Type');
      expect(headers).toContain('Authorization');
    });

    it('should include max age header', async () => {
      const res = await app.request('/test', {
        headers: {
          Origin: 'https://example.com',
        },
      });

      expect(res.headers.get('Access-Control-Max-Age')).toBeDefined();
    });
  });

  describe('Specific origins', () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use(
      '*',
      cors({
        origin: ['https://example.com', 'https://test.com'],
      })
    );
    app.get('/test', (c) => c.json({ success: true }));

    it('should allow whitelisted origin', async () => {
      const res = await app.request('/test', {
        headers: {
          Origin: 'https://example.com',
        },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://example.com'
      );
    });

    it('should allow another whitelisted origin', async () => {
      const res = await app.request('/test', {
        headers: {
          Origin: 'https://test.com',
        },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://test.com'
      );
    });

    it('should not set CORS header for non-whitelisted origin', async () => {
      const res = await app.request('/test', {
        headers: {
          Origin: 'https://malicious.com',
        },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should not set CORS header when no origin is provided', async () => {
      const res = await app.request('/test');

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  describe('Preflight requests (OPTIONS)', () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', cors({ origin: '*' }));
    app.post('/test', (c) => c.json({ success: true }));

    it('should handle OPTIONS preflight request', async () => {
      const res = await app.request('/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should return empty body for OPTIONS request', async () => {
      const res = await app.request('/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
        },
      });

      const body = await res.text();
      expect(body).toBe('');
    });
  });

  describe('Custom configuration', () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use(
      '*',
      cors({
        origin: '*',
        allowMethods: ['GET', 'POST'],
        allowHeaders: ['X-Custom-Header'],
        exposeHeaders: ['X-Response-Header'],
        maxAge: 3600,
      })
    );
    app.get('/test', (c) => c.json({ success: true }));

    it('should use custom allowed methods', async () => {
      const res = await app.request('/test', {
        headers: {
          Origin: 'https://example.com',
        },
      });

      const methods = res.headers.get('Access-Control-Allow-Methods');
      expect(methods).toBe('GET, POST');
    });

    it('should use custom allowed headers', async () => {
      const res = await app.request('/test', {
        headers: {
          Origin: 'https://example.com',
        },
      });

      const headers = res.headers.get('Access-Control-Allow-Headers');
      expect(headers).toBe('X-Custom-Header');
    });

    it('should set exposed headers', async () => {
      const res = await app.request('/test', {
        headers: {
          Origin: 'https://example.com',
        },
      });

      const exposedHeaders = res.headers.get('Access-Control-Expose-Headers');
      expect(exposedHeaders).toBe('X-Response-Header');
    });

    it('should use custom max age', async () => {
      const res = await app.request('/test', {
        headers: {
          Origin: 'https://example.com',
        },
      });

      expect(res.headers.get('Access-Control-Max-Age')).toBe('3600');
    });
  });

  describe('Integration with actual endpoints', () => {
    it('should work with API routes', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', cors({ origin: '*' }));
      app.get('/api/data', (c) => c.json({ data: 'test' }));

      const res = await app.request('/api/data', {
        headers: {
          Origin: 'https://example.com',
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');

      const data = await res.json();
      expect(data).toEqual({ data: 'test' });
    });

    it('should work with UI routes', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', cors({ origin: '*' }));
      app.get('/', (c) => c.html('<html><body>Test</body></html>'));

      const res = await app.request('/', {
        headers: {
          Origin: 'https://example.com',
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');

      const html = await res.text();
      expect(html).toContain('Test');
    });
  });
});
