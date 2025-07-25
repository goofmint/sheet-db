import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		// Run tests sequentially to prevent Auth0 rate limiting
		sequence: {
			concurrent: false,
		},
		// Disable file parallelism completely
		maxConcurrency: 1,
		fileParallelism: false,
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				singleWorker: true,
			},
		},
		// Coverage disabled due to Cloudflare Workers compatibility issues
		// Use external c8 for coverage if needed
	},
});