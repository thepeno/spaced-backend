import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

import { defineConfig } from 'vitest/config'

// export default defineWorkersConfig({
// 	test: {
// 		poolOptions: {
// 			workers: {
// 				wrangler: { configPath: './wrangler.json' },
// 			},
// 		},
// 		environment: 'node',
// 		include: ['test/**/*.test.ts'],
// 	},
// });

export default defineConfig({
	test: {
		// environment: 'node',
		include: ['test/**/*.test.ts'],
	},
});
