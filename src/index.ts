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
import { playgroundHTML } from './playground-html';

type Bindings = {
	DB: D1Database;
};

const app = new OpenAPIHono<{ Bindings: Bindings }>();

// Static file serving
app.use('/static/*', serveStatic({ 
  root: './public',
  manifest: {}
}));

// Root endpoint
app.get('/', async (c) => {
	try {
		const db = drizzle(c.env.DB);
		const configs = await db.select().from(configTable);
		
		if (configs.length === 0) {
			return c.redirect('/setup');
		}
		
		return c.text('Sheet DB API');
	} catch (error) {
		// テーブルが存在しない場合は初期化が必要
		return c.redirect('/setup');
	}
});

// Health check endpoint
app.get('/health', (c) => {
	return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Playground endpoint
app.get('/playground', (c) => {
	return c.html(playgroundHTML);
});

// Register all route modules
registerSwaggerUI(app);           // /doc
registerOpenAPISpec(app);         // /doc/openapi.json
registerAuthRoutes(app);          // /api/auth/*
registerSetupRoutes(app);         // /setup/* and /api/setup/*
registerRoleRoutes(app);          // /api/roles/*
registerUserRoutes(app);          // /api/users/*
registerSheetRoutes(app);         // /api/sheets/*

export default app;