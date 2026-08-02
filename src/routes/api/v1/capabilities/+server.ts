import { json, type RequestHandler } from '@sveltejs/kit';
import { getBackendServices } from '$lib/server/services';
import { privateApiError, privateApiHeaders } from '$lib/server/http';

export const GET: RequestHandler = async ({ request }) => {
	const services = getBackendServices();
	const identity = await services.auth.getIdentity(request);
	if (!identity) return privateApiError(401, 'UNAUTHENTICATED');
	return json({ capabilities: await services.capabilities.getCapabilities(identity.userId) }, { headers: privateApiHeaders });
};
