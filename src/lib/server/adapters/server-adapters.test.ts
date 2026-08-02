import { describe, expect, it, vi } from 'vitest';
import { DeepSeekAiAdapter } from '$lib/server/adapters/deepseek';
import { SupabaseAuthAdapter } from '$lib/server/adapters/supabase-auth';

describe('server adapters', () => {
	it('normalizes every model response into a non-executable proposal', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			choices: [{ message: { content: JSON.stringify({
				summary: 'Registrar almuerzo',
				transactions: [{ type: 'expense', amountMinor: 2500, currency: 'PEN', categoryCode: 'food', date: '2026-08-01T12:00:00-05:00', note: 'Almuerzo' }]
			}) } }], usage: { total_tokens: 42 }
	}), { status: 200 }));
		const adapter = new DeepSeekAiAdapter({ apiKey: 'test-key', baseUrl: 'https://api.example.test', model: 'test-model' }, fetchFn);

		const result = await adapter.createProposal({
			source: 'voice', text: 'Gasté 25 soles en almuerzo', locale: 'es-PE', timeZone: 'America/Lima', currency: 'PEN',
			idempotencyKey: 'c03660fc-2c2a-4fcd-ac6e-0dfcd8c790f3', now: '2026-08-01T12:00:00.000Z'
		});

		expect(result.usedUnits).toBe(42);
		expect(result.action).toMatchObject({ operation: 'propose', requiresConfirmation: false, idempotencyKey: 'c03660fc-2c2a-4fcd-ac6e-0dfcd8c790f3' });
		expect(fetchFn).toHaveBeenCalledWith('https://api.example.test/chat/completions', expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer test-key' }) }));
	});

	it('does not authenticate malformed responses from Supabase', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'not-a-uuid' }), { status: 200 }));
		const adapter = new SupabaseAuthAdapter({ url: 'https://project.supabase.co', publishableKey: 'publishable-key' }, fetchFn);
		const identity = await adapter.getIdentity(new Request('https://app.example.test/api', { headers: { authorization: 'Bearer user-token' } }));

		expect(identity).toBeNull();
		expect(fetchFn).toHaveBeenCalledWith('https://project.supabase.co/auth/v1/user', expect.objectContaining({ headers: expect.objectContaining({ apikey: 'publishable-key' }) }));
	});
});
