import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';

export default defineWorkersConfig({
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	test: {
		// Include only unit tests, exclude integration and e2e tests
		include: ['test/**/*.{test,spec}.{js,ts}'],
		exclude: ['**/node_modules/**', '**/tests-e2e/**', '**/test/integration/**'],
		
		// HTML test reporter configuration
		reporters: ['default', 'html'],
		outputFile: './test-result.html',
		
		// Run tests sequentially to prevent Auth0 rate limiting
		sequence: {
			concurrent: false,
		},
		// Disable file parallelism completely
		maxConcurrency: 1,
		fileParallelism: false,
		poolOptions: {
			workers: {
				wrangler: { 
					configPath: './wrangler.jsonc',
					environment: 'test'
				},
				singleWorker: true,
			},
		},
		// istanbul coverage configuration  
		coverage: {
			provider: 'istanbul',
			reporter: ['text', 'json', 'html'],
			include: ['src/**/*.ts', 'src/**/*.tsx'],
			exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
		},
	},
});