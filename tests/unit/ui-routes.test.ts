/**
 * UI Routes tests
 *
 * Tests all UI page endpoints including:
 * - Dashboard page
 * - Settings page
 * - Setup page
 * - Response status codes
 * - HTML content validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../src/index.tsx';
import { getTestEnv } from '../helpers/test-app';

describe('UI Routes', () => {
  describe('Dashboard Page (/)', () => {
    it('should return 200 status code', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/', {
        method: 'GET',
      }, testEnv);

      expect(res.status).toBe(200);
    });

    it('should return HTML content', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/', {}, testEnv);

      expect(res.headers.get('Content-Type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
    });

    it('should include Dashboard title', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Dashboard - Sheet DB Admin');
    });

    it('should include Header component', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Sheet DB Admin');
    });

    it('should include Sidebar component with navigation', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Dashboard');
      expect(html).toContain('System Settings');
      expect(html).toContain('Initial Setup');
    });

    it('should include Dashboard content', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Welcome to Sheet DB Admin Panel');
    });
  });

  describe('Settings Page (/settings)', () => {
    it('should return 200 status code', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/settings', {
        method: 'GET',
      }, testEnv);

      expect(res.status).toBe(200);
    });

    it('should return HTML content', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/settings', {}, testEnv);

      expect(res.headers.get('Content-Type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
    });

    it('should include Settings title', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/settings', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('System Settings - Sheet DB Admin');
    });

    it('should include Settings page heading', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/settings', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('System Settings');
    });

    it('should include settings configuration functionality', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/settings', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('System Settings');
      expect(html).toContain('settings-container');
      expect(html).toContain('loadSettings');
    });
  });

  describe('Setup Page (/setup)', () => {
    // Clear setup_completed flag before each test
    beforeEach(async () => {
      const env = await getTestEnv();
      await env.DB.prepare('DELETE FROM config WHERE key = ?')
        .bind('setup_completed')
        .run();
    });

    it('should return 200 status code', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/setup', {
        method: 'GET',
      }, testEnv);

      expect(res.status).toBe(200);
    });

    it('should return HTML content', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/setup', {}, testEnv);

      expect(res.headers.get('Content-Type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
    });

    it('should include Setup title', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/setup', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Initial Setup - Sheet DB Admin');
    });

    it('should include Setup page heading', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/setup', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Initial Setup');
    });

    it('should describe Google Sheets connection features', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/setup', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Google');
      expect(html).toContain('OAuth');
    });
  });

  describe('CORS headers on UI routes', () => {
    it('should include CORS headers on dashboard', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/', {
        method: 'GET',
        headers: {
          Origin: 'https://example.com',
        },
      }, testEnv);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should include CORS headers on settings', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/settings', {
        method: 'GET',
        headers: {
          Origin: 'https://example.com',
        },
      }, testEnv);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should include CORS headers on setup', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/setup', {
        method: 'GET',
        headers: {
          Origin: 'https://example.com',
        },
      }, testEnv);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Viewport and responsive design', () => {
    it('should include viewport meta tag on dashboard', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('name="viewport"');
      expect(html).toContain('width=device-width');
    });

    it('should include viewport meta tag on settings', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/settings', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('name="viewport"');
      expect(html).toContain('width=device-width');
    });

    it('should include viewport meta tag on setup', async () => {
      const testEnv = await getTestEnv();
      const res = await app.request('/setup', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('name="viewport"');
      expect(html).toContain('width=device-width');
    });
  });
});
