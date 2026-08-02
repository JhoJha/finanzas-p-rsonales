import type { AgentAction } from '$lib/contracts/agent';
import type { AiRequest } from '$lib/contracts/api';
import type { CapabilitySnapshot } from '$lib/contracts/providers';

export interface AuthenticatedIdentity {
	userId: string;
}

export interface ServerAuthAdapter {
	getIdentity(request: Request): Promise<AuthenticatedIdentity | null>;
}

export interface ServerCapabilitiesAdapter {
	getCapabilities(userId: string): Promise<CapabilitySnapshot & { remainingAiRequests: number | null }>;
	/** Reserva una solicitud de IA de forma atómica antes de llamar al proveedor. */
	reserveAiRequest(userId: string, idempotencyKey: string): Promise<boolean>;
	/** Libera una reserva que no llegó a invocar al proveedor. */
	releaseAiRequest(userId: string, idempotencyKey: string): Promise<void>;
	/** Métrica de telemetría; los tokens no determinan la cuota de solicitudes. */
	recordAiUsage(userId: string, usage: { providerTokens: number }): Promise<void>;
}

export interface ServerAiAdapter {
	createProposal(input: AiRequest & { idempotencyKey: string; now: string }): Promise<{ action: AgentAction; providerTokens: number }>;
}

export interface BackendServices {
	auth: ServerAuthAdapter;
	capabilities: ServerCapabilitiesAdapter;
	ai: ServerAiAdapter | null;
}
