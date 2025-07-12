import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { configTable, cacheTable, queueTable, sessionTable } from '../src/db/schema';
import { getTableColumns, sql } from 'drizzle-orm';
import app from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `app.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Sheet DB API', () => {
	beforeAll(async () => {
		// Setup database for testing
		const db = drizzle(env.DB);
		
		// Create tables using Drizzle schema definitions - create the tables as they are defined in the schema
		try {
			// Create Config table based on configTable schema with unique constraint
			await db.run(sql`CREATE TABLE IF NOT EXISTS "Config" (
				"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
				"name" text NOT NULL UNIQUE,
				"value" text NOT NULL
			)`);
			
			// Create Cache table based on cacheTable schema
			await db.run(sql`CREATE TABLE IF NOT EXISTS "Cache" (
				"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
				"name" text NOT NULL,
				"value" text NOT NULL
			)`);
			
			// Create Queue table based on queueTable schema
			await db.run(sql`CREATE TABLE IF NOT EXISTS "Queue" (
				"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
				"userId" text NOT NULL,
				"action" text NOT NULL,
				"value" text NOT NULL
			)`);
			
			// Create Session table based on sessionTable schema
			await db.run(sql`CREATE TABLE IF NOT EXISTS "Session" (
				"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
				"userId" text NOT NULL,
				"value" text NOT NULL,
				"expiresAt" integer NOT NULL
			)`);
			
			// Insert setup_completed config to indicate setup is done using Drizzle's API
			await db.insert(configTable)
				.values({ name: 'setup_completed', value: 'true' })
				.onConflictDoUpdate({
					target: configTable.name,
					set: { value: 'true' }
				});
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
