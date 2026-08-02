import { loadServerConfig } from '$lib/server/config';
import type { BackendServices } from '$lib/server/contracts';
import { DisabledAuthAdapter, DisabledCapabilitiesAdapter } from '$lib/server/adapters/disabled';
import { DeepSeekAiAdapter } from '$lib/server/adapters/deepseek';
import { SupabaseAuthAdapter } from '$lib/server/adapters/supabase-auth';
import type { ServerConfig } from '$lib/server/config.schema';

export function createBackendServices(config: ServerConfig): BackendServices {
	return {
		auth: config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY
			? new SupabaseAuthAdapter({ url: config.SUPABASE_URL, publishableKey: config.SUPABASE_PUBLISHABLE_KEY })
			: new DisabledAuthAdapter(),
		capabilities: new DisabledCapabilitiesAdapter(),
		ai: config.DEEPSEEK_API_KEY
			? new DeepSeekAiAdapter({ apiKey: config.DEEPSEEK_API_KEY, baseUrl: config.DEEPSEEK_BASE_URL, model: config.DEEPSEEK_MODEL })
			: null
	};
}

let services: BackendServices | undefined;

export function getBackendServices(): BackendServices {
	services ??= createBackendServices(loadServerConfig());
	return services;
}
