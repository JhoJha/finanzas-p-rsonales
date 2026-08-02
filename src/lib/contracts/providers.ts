import type { AgentAction } from '$lib/contracts/agent';

/** Contratos sin dependencia de Supabase, DeepSeek ni un proveedor de pagos. */
export interface AuthAdapter {
	getSession(): Promise<{ userId: string } | null>;
}

export interface CapabilitySnapshot {
	voice_ai: boolean;
	chatbot: boolean;
	advanced_analysis: boolean;
	cloud_sync: boolean;
	monthly_ai_limit: number;
	subscription_status: 'free' | 'active' | 'past_due' | 'canceled';
	current_period_end?: string;
}

export interface CapabilitiesAdapter {
	getCapabilities(userId: string): Promise<CapabilitySnapshot>;
	recordAiUsage(userId: string, units: number): Promise<void>;
}

/** El adaptador recibe contexto minimizado y devuelve una propuesta, nunca una escritura local. */
export interface AiAdapter {
	interpret(input: { text: string; locale: string; timeZone: string; currency: string }): Promise<AgentAction>;
}
