import { OpenAPIHono } from '@hono/zod-openapi';
import { serveStatic } from 'hono/cloudflare-workers';
import { drizzle } from 'drizzle-orm/d1';
import { configTable } from './db/schema';
import { registerAuthRoutes } from './api/auth';
import { registerSetupRoutes } from './api/setup';
import { registerSwaggerUI, registerOpenAPISpec } from './api/openapi';
import { registerRoleRoutes } from './api/role';
import { registerUserRoutes } from './api/user';
import { registerSheetRoutes } from './api/sheet';
import { registerFileRoutes } from './api/files';
import { loadTemplate } from './utils/template-loader';
import { isSetupCompleted } from './google-auth';

type Bindings = {
	DB: D1Database;
	ASSETS: Fetcher;
	R2_BUCKET?: R2Bucket;
	RATE_LIMIT_KV?: KVNamespace;
};

const app = new OpenAPIHono<{ Bindings: Bindings }>();

// Redirect /setup to /setup-page to avoid conflict with static assets
// This must be registered before any static file serving
app.get('/setup', (c) => c.redirect('/setup-page'));

// Static file serving
app.use('/static/*', serveStatic({ 
  root: './public',
  manifest: {}
}));

// Root endpoint
app.get('/', async (c) => {
	try {
		const db = drizzle(c.env.DB);
		
		// Check if setup is completed
		const setupCompleted = await isSetupCompleted(db);
		
		if (!setupCompleted) {
			return c.redirect('/setup-page');
		}
		
		// Redirect to playground if setup is completed
		return c.redirect('/playground');
	} catch (error) {
		// If table doesn't exist, initialization is required
		return c.redirect('/setup-page');
	}
});

// Health check endpoint
app.get('/health', (c) => {
	return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Playground endpoint
app.get('/playground', async (c) => {
	const html = await loadTemplate(c.env.ASSETS, 'playground.html');
	return c.html(html);
});

// Register all route modules
registerSwaggerUI(app);           // /doc
registerOpenAPISpec(app);         // /doc/openapi.json
registerAuthRoutes(app);          // /api/auth/*
registerSetupRoutes(app);         // /setup-page/* and /api/setup/*
registerRoleRoutes(app);          // /api/roles/*
registerUserRoutes(app);          // /api/users/*
registerSheetRoutes(app);         // /api/sheets/*
registerFileRoutes(app);          // /api/files/*

export default app;