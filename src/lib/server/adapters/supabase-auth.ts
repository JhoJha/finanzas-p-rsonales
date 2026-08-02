import { z } from 'zod';
import type { ServerAuthAdapter, AuthenticatedIdentity } from '$lib/server/contracts';

const SupabaseUserSchema = z.object({ id: z.string().uuid() });

/**
 * Verifica el bearer token con Supabase Auth; no decodifica JWTs localmente ni
 * confía en cabeceras sin validación remota.
 */
export class SupabaseAuthAdapter implements ServerAuthAdapter {
	constructor(private readonly config: { url: string; publishableKey: string }, private readonly fetchFn: typeof fetch = fetch) {}

	async getIdentity(request: Request): Promise<AuthenticatedIdentity | null> {
		const authorization = request.headers.get('authorization');
		if (!authorization?.startsWith('Bearer ')) return null;
		const token = authorization.slice('Bearer '.length).trim();
		if (!token) return null;

		try {
			const response = await this.fetchFn(`${this.config.url.replace(/\/$/, '')}/auth/v1/user`, {
				headers: { apikey: this.config.publishableKey, authorization: `Bearer ${token}` }
			});
			if (!response.ok) return null;
			const user = SupabaseUserSchema.safeParse(await response.json());
			return user.success ? { userId: user.data.id } : null;
		} catch {
			return null;
		}
	}
}
