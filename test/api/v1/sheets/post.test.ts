import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { app } from '@/index';
import { ConfigService } from '@/services/config';
import { GoogleOAuthService } from '@/services/google-oauth';

describe('POST /api/v1/sheets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should validate required sheet name', async () => {
    const response = await app.request('/api/v1/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('bad_request');
    expect(data.details).toContain('required');
  });

  it('should validate sheet name length', async () => {
    const response = await app.request('/api/v1/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'a'.repeat(101)
      })
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('bad_request');
    expect(data.details).toContain('between 1 and 100 characters');
  });

  it('should validate sheet name characters', async () => {
    const response = await app.request('/api/v1/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid@Name!'
      })
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('bad_request');
    expect(data.details).toContain('invalid characters');
  });

  it('should validate headers array', async () => {
    const response = await app.request('/api/v1/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'TestSheet',
        headers: 'not-an-array'
      })
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('bad_request');
    expect(data.details).toContain('array of strings');
  });

  it('should validate headers count', async () => {
    const headers = Array(51).fill('column');
    const response = await app.request('/api/v1/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'TestSheet',
        headers: headers
      })
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('bad_request');
    expect(data.details).toContain('Maximum 50 headers');
  });

  it('should validate individual header length', async () => {
    const response = await app.request('/api/v1/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'TestSheet',
        headers: ['valid', 'a'.repeat(51)]
      })
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('bad_request');
    expect(data.details).toContain('between 1 and 50 characters');
  });

  it('should allow Japanese characters in sheet name', async () => {
    const response = await app.request('/api/v1/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テストシート_123'
      })
    });
    
    // Will return 500 in test environment due to Google API not being available
    // but we're checking that it passes validation (not 400)
    expect(response.status).not.toBe(400);
  });
});