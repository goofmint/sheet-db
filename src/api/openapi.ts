import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';

type Bindings = {
	DB: D1Database;
};

// Swagger UI endpoint
export function registerSwaggerUI(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.get('/doc', swaggerUI({ url: '/doc/openapi.json' }));
}

// OpenAPI JSON specification endpoint
export function registerOpenAPISpec(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.get('/doc/openapi.json', (c) => {
		try {
			// 手動でOpenAPI仕様書を構築
			const openAPISpec = {
				openapi: '3.0.0',
				info: {
					title: 'Sheet DB API',
					version: '1.0.0',
					description: 'A REST API for managing data in Google Sheets with Auth0 authentication'
				},
				servers: [
					{
						url: '/',
						description: 'Current server'
					}
				],
				// セキュリティスキームを手動で定義
				components: {
					securitySchemes: {
						BearerAuth: {
							type: 'http',
							scheme: 'bearer',
							bearerFormat: 'JWT',
							description: 'Session token obtained from authentication'
						}
					}
				},
				// パスの定義
				paths: {}
			};

			// アプリケーションで定義されたルートを取得してパスに追加
			if (app.getOpenAPIDocument) {
				try {
					const appSpec = app.getOpenAPIDocument({
						openapi: '3.0.0',
						info: {
							title: 'Sheet DB API',
							version: '1.0.0'
						}
					});
					if (appSpec && appSpec.paths) {
						openAPISpec.paths = appSpec.paths;
					}
					// components.schemasも統合
					if (appSpec && appSpec.components) {
						openAPISpec.components = {
							...openAPISpec.components,
							...appSpec.components,
							// Ensure securitySchemes is preserved
							securitySchemes: openAPISpec.components.securitySchemes
						};
					}
				} catch (docError) {
					console.warn('Failed to get OpenAPI document from app:', docError);
				}
			}

			return c.json(openAPISpec);
		} catch (error) {
			console.error('Error generating OpenAPI spec:', error);
			return c.json({ error: 'Failed to generate OpenAPI specification' }, 500);
		}
	});
}