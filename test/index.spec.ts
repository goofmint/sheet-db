import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { configTable } from '../src/db/schema';
import { sql } from 'drizzle-orm';
import app from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `app.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Sheet DB API', () => {
	beforeAll(async () => {
		// Setup database for testing
		const db = drizzle(env.DB);
		
		// Create tables if they don't exist
		try {
			await db.run(sql`CREATE TABLE IF NOT EXISTS Config (Id INTEGER PRIMARY KEY, Name TEXT, Value TEXT)`);
			await db.run(sql`CREATE TABLE IF NOT EXISTS Cache (Id INTEGER PRIMARY KEY, Name TEXT, Value TEXT)`);
			await db.run(sql`CREATE TABLE IF NOT EXISTS Queue (Id INTEGER PRIMARY KEY, UserId TEXT, Action TEXT, Value TEXT, Response TEXT, Status TEXT)`);
			await db.run(sql`CREATE TABLE IF NOT EXISTS Session (Id INTEGER PRIMARY KEY, UserId TEXT, Value TEXT, ExpiresAt INTEGER)`);
			
			// Insert setup_completed config to indicate setup is done
			await db.run(sql`INSERT OR REPLACE INTO Config (Name, Value) VALUES ('setup_completed', 'true')`);
		} catch (error) {
			console.warn('Database setup error:', error);
		}
	});
	it('redirects to playground when setup is complete (unit style)', async () => {
		const request = new IncomingRequest('http://localhost:8787');
		// Create an empty context to pass to `app.fetch()`.
		const ctx = createExecutionContext();
		const response = await app.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/playground');
	});

	it('redirects to playground when setup is complete (integration style)', async () => {
		const response = await SELF.fetch('http://localhost:8787', { redirect: 'manual' });
		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/playground');
	});

	it('health check endpoint works', async () => {
		const response = await SELF.fetch('http://localhost:8787/health');
		expect(response.status).toBe(200);
		const data = (await response.json()) as { status: string; timestamp: string };
		expect(data.status).toBe('ok');
		expect(data.timestamp).toBeDefined();
	});

	it('playground endpoint returns 200', async () => {
		const response = await SELF.fetch('http://localhost:8787/playground');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');
	});

	it('API documentation endpoint returns 200', async () => {
		const response = await SELF.fetch('http://localhost:8787/doc');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');
	});

	it('OpenAPI schema endpoint returns valid JSON', async () => {
		const response = await SELF.fetch('http://localhost:8787/doc/openapi.json');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/json');
		const schema = await response.json();
		expect(schema).toHaveProperty('openapi');
		expect(schema).toHaveProperty('info');
		expect(schema).toHaveProperty('paths');
	});
});
