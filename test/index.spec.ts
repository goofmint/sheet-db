import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import app from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `app.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Sheet DB API', () => {
	it('redirects to setup when no config exists (unit style)', async () => {
		const request = new IncomingRequest('http://example.com');
		// Create an empty context to pass to `app.fetch()`.
		const ctx = createExecutionContext();
		const response = await app.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/setup');
	});

	it('redirects to setup when no config exists (integration style)', async () => {
		const response = await SELF.fetch('https://example.com', { redirect: 'manual' });
		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/setup');
	});

	it('health check endpoint works', async () => {
		const response = await SELF.fetch('https://example.com/health');
		expect(response.status).toBe(200);
		const data = (await response.json()) as { status: string; timestamp: string };
		expect(data.status).toBe('ok');
		expect(data.timestamp).toBeDefined();
	});
});
