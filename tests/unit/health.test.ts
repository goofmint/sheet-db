import { describe, it, expect } from 'vitest';
import app from '../../src/index.tsx';

describe('Health API', () => {
  it('should return ok status', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('ok');
  });

  it('should return timestamp', async () => {
    const res = await app.request('/api/health');
    const data = await res.json();

    expect(data.data.timestamp).toBeDefined();
    expect(new Date(data.data.timestamp).getTime()).toBeGreaterThan(0);
  });
});
