import { z } from 'zod';

const optionalSecret = z.string().trim().min(1).optional();

export const ServerConfigSchema = z.object({
	SUPABASE_URL: z.url().optional(),
	SUPABASE_PUBLISHABLE_KEY: optionalSecret,
	DEEPSEEK_API_KEY: optionalSecret,
	DEEPSEEK_BASE_URL: z.url().default('https://api.deepseek.com'),
	DEEPSEEK_MODEL: z.string().trim().min(1).default('deepseek-v4-flash'),
	MONTHLY_AI_LIMIT: z.coerce.number().int().min(0).max(10_000).default(0)
}).superRefine((config, context) => {
	if (Boolean(config.SUPABASE_URL) !== Boolean(config.SUPABASE_PUBLISHABLE_KEY)) {
		context.addIssue({ code: 'custom', path: ['SUPABASE_URL'], message: 'SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY deben configurarse juntos.' });
	}
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export function parseServerConfig(input: Record<string, string | undefined>): ServerConfig {
	return ServerConfigSchema.parse(input);
}
