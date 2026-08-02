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
	recordAiUsage(userId: string, units: number): Promise<void>;
}

export interface ServerAiAdapter {
	createProposal(input: AiRequest & { idempotencyKey: string; now: string }): Promise<{ action: AgentAction; usedUnits: number }>;
}

export interface BackendServices {
	auth: ServerAuthAdapter;
	capabilities: ServerCapabilitiesAdapter;
	ai: ServerAiAdapter | null;
}
