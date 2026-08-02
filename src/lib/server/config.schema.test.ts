import { describe, expect, it } from 'vitest';
import { parseServerConfig } from '$lib/server/config.schema';

describe('server configuration', () => {
	it('uses disabled, safe defaults without any secret', () => {
		expect(parseServerConfig({})).toMatchObject({
			DEEPSEEK_BASE_URL: 'https://api.deepseek.com', DEEPSEEK_MODEL: 'deepseek-v4-flash', MONTHLY_AI_LIMIT: 0
		});
	});

	it('requires the Supabase URL and publishable key together', () => {
		expect(() => parseServerConfig({ SUPABASE_URL: 'https://project.supabase.co' })).toThrow('deben configurarse juntos');
	});
});
