import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.json' },
				miniflare: {
					d1Databases: ["D1"]
				}
			},
		},
		include: ['test/**/*.test.ts'],
	},
});
