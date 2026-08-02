import { json } from '@sveltejs/kit';

export function privateApiError(status: 400 | 401 | 403 | 429 | 503, code: 'INVALID_REQUEST' | 'UNAUTHENTICATED' | 'CAPABILITY_UNAVAILABLE' | 'QUOTA_EXHAUSTED' | 'SERVICE_UNAVAILABLE') {
	return json({ error: { code } }, { status, headers: { 'cache-control': 'no-store' } });
}

export const privateApiHeaders = { 'cache-control': 'no-store' };
