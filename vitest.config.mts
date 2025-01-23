import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.json' },
				miniflare: {
					d1Databases: ['D1'],
				},
			},
		},
		include: ['test/**/*.test.ts'],
		setupFiles: ['test/integration/setup.ts'],
	},
	plugins: [tsconfigPaths()],
});
