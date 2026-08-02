import type { CapabilitySnapshot } from '$lib/contracts/providers';
import type { ServerAuthAdapter, ServerCapabilitiesAdapter } from '$lib/server/contracts';

export class DisabledAuthAdapter implements ServerAuthAdapter {
	async getIdentity(): Promise<null> { return null; }
}

/** Nunca habilita IA sin un servicio persistente de cuotas y permisos. */
export class DisabledCapabilitiesAdapter implements ServerCapabilitiesAdapter {
	async getCapabilities(): Promise<CapabilitySnapshot & { remainingAiRequests: number | null }> {
		return {
			voice_ai: false, chatbot: false, advanced_analysis: false, cloud_sync: false,
			monthly_ai_limit: 0, subscription_status: 'free', remainingAiRequests: null
		};
	}
	async reserveAiRequest(): Promise<boolean> { return false; }
	async releaseAiRequest(): Promise<void> {}
	async recordAiUsage(): Promise<void> {}
}
