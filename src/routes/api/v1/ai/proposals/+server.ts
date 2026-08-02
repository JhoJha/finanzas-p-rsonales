import { json, type RequestHandler } from '@sveltejs/kit';
import { AiRequestSchema, AiProposalResponseSchema } from '$lib/contracts/api';
import { getBackendServices } from '$lib/server/services';
import { privateApiError, privateApiHeaders } from '$lib/server/http';

export const POST: RequestHandler = async ({ request }) => {
	const services = getBackendServices();
	const identity = await services.auth.getIdentity(request);
	if (!identity) return privateApiError(401, 'UNAUTHENTICATED');

	let body: unknown;
	try { body = await request.json(); } catch { return privateApiError(400, 'INVALID_REQUEST'); }
	const input = AiRequestSchema.safeParse(body);
	if (!input.success) return privateApiError(400, 'INVALID_REQUEST');

	const capabilities = await services.capabilities.getCapabilities(identity.userId);
	if (!(input.data.source === 'voice' ? capabilities.voice_ai : capabilities.chatbot)) return privateApiError(403, 'CAPABILITY_UNAVAILABLE');
	if (capabilities.remainingAiRequests !== null && capabilities.remainingAiRequests <= 0) return privateApiError(429, 'QUOTA_EXHAUSTED');
	if (!services.ai) return privateApiError(503, 'SERVICE_UNAVAILABLE');

	try {
		const result = await services.ai.createProposal({ ...input.data, idempotencyKey: crypto.randomUUID(), now: new Date().toISOString() });
		await services.capabilities.recordAiUsage(identity.userId, result.usedUnits);
		return json(AiProposalResponseSchema.parse({ action: result.action, remainingQuota: capabilities.remainingAiRequests === null ? null : capabilities.remainingAiRequests - 1 }), { headers: privateApiHeaders });
	} catch {
		return privateApiError(503, 'SERVICE_UNAVAILABLE');
	}
};
