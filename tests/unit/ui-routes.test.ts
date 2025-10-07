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

import { describe, it, expect } from 'vitest';
import app from '../../src/index.tsx';
import { createTestEnv } from '../helpers/test-app';

describe('UI Routes', () => {
  const testEnv = createTestEnv();
  describe('Dashboard Page (/)', () => {
    it('should return 200 status code', async () => {
      const res = await app.request('/', {
        method: 'GET',
      }, testEnv);

      expect(res.status).toBe(200);
    });

    it('should return HTML content', async () => {
      const res = await app.request('/', {}, testEnv);

      expect(res.headers.get('Content-Type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
    });

    it('should include Dashboard title', async () => {
      const res = await app.request('/', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Dashboard - Sheet DB Admin');
    });

    it('should include Header component', async () => {
      const res = await app.request('/', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Sheet DB Admin');
    });

    it('should include Sidebar component with navigation', async () => {
      const res = await app.request('/', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Dashboard');
      expect(html).toContain('System Settings');
      expect(html).toContain('Initial Setup');
    });

    it('should include Dashboard content', async () => {
      const res = await app.request('/', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Welcome to Sheet DB Admin Panel');
    });
  });

  describe('Settings Page (/settings)', () => {
    it('should return 200 status code', async () => {
      const res = await app.request('/settings', {
        method: 'GET',
      }, testEnv);

      expect(res.status).toBe(200);
    });

    it('should return HTML content', async () => {
      const res = await app.request('/settings', {}, testEnv);

      expect(res.headers.get('Content-Type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
    });

    it('should include Settings title', async () => {
      const res = await app.request('/settings', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('System Settings - Sheet DB Admin');
    });

    it('should include Settings page heading', async () => {
      const res = await app.request('/settings', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('System Settings');
    });

    it('should include placeholder content for Task 2.2', async () => {
      const res = await app.request('/settings', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Task 2.2');
    });
  });

  describe('Setup Page (/setup)', () => {
    it('should return 200 status code', async () => {
      const res = await app.request('/setup', {
        method: 'GET',
      }, testEnv);

      expect(res.status).toBe(200);
    });

    it('should return HTML content', async () => {
      const res = await app.request('/setup', {}, testEnv);

      expect(res.headers.get('Content-Type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
    });

    it('should include Setup title', async () => {
      const res = await app.request('/setup', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Initial Setup - Sheet DB Admin');
    });

    it('should include Setup page heading', async () => {
      const res = await app.request('/setup', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Initial Setup');
    });

    it('should include placeholder content for Task 2.1', async () => {
      const res = await app.request('/setup', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Task 2.1');
    });

    it('should describe Google Sheets connection features', async () => {
      const res = await app.request('/setup', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('Google');
      expect(html).toContain('OAuth');
    });
  });

  describe('CORS headers on UI routes', () => {
    it('should include CORS headers on dashboard', async () => {
      const res = await app.request('/', {
        method: 'GET',
        headers: {
          Origin: 'https://example.com',
        },
      }, testEnv);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should include CORS headers on settings', async () => {
      const res = await app.request('/settings', {
        method: 'GET',
        headers: {
          Origin: 'https://example.com',
        },
      }, testEnv);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should include CORS headers on setup', async () => {
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
      const res = await app.request('/', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('name="viewport"');
      expect(html).toContain('width=device-width');
    });

    it('should include viewport meta tag on settings', async () => {
      const res = await app.request('/settings', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('name="viewport"');
      expect(html).toContain('width=device-width');
    });

    it('should include viewport meta tag on setup', async () => {
      const res = await app.request('/setup', {}, testEnv);
      const html = await res.text();

      expect(html).toContain('name="viewport"');
      expect(html).toContain('width=device-width');
    });
  });
});
