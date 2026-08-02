import { z } from 'zod';
import { AgentActionSchema, TransactionIntentSchema, type AgentAction } from '$lib/contracts/agent';
import type { ServerAiAdapter } from '$lib/server/contracts';

const ModelProposalSchema = z.object({
	summary: z.string().trim().min(1).max(500),
	transactions: z.array(TransactionIntentSchema).max(50).default([])
});

const DeepSeekResponseSchema = z.object({
	choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
	usage: z.object({ total_tokens: z.number().int().nonnegative() }).optional()
});

export class DeepSeekAiAdapter implements ServerAiAdapter {
	constructor(
		private readonly config: { apiKey: string; baseUrl: string; model: string },
		private readonly fetchFn: typeof fetch = fetch
	) {}

	async createProposal(input: { source: 'voice' | 'chat'; text: string; locale: 'es-PE' | 'en-US'; timeZone: string; currency: string; idempotencyKey: string; now: string }): Promise<{ action: AgentAction; usedUnits: number }> {
		const response = await this.fetchFn(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
			method: 'POST',
			headers: { authorization: `Bearer ${this.config.apiKey}`, 'content-type': 'application/json' },
			body: JSON.stringify({
				model: this.config.model,
				temperature: 0,
				max_tokens: 1_000,
				response_format: { type: 'json_object' },
				messages: [
					{ role: 'system', content: `Return only valid JSON with {"summary":string,"transactions":TransactionIntent[]}. Interpret a personal-finance ${input.source} entry. Do not execute, edit, delete, or claim data was saved. Use currency ${input.currency}, locale ${input.locale}, timezone ${input.timeZone}, current timestamp ${input.now}. Each amount is amountMinor integer and every transaction has type, categoryCode, date ISO with offset; return an empty transactions array when unsure.` },
					{ role: 'user', content: input.text }
				]
			})
		});
		if (!response.ok) throw new Error('AI_PROVIDER_UNAVAILABLE');
		const payload = DeepSeekResponseSchema.safeParse(await response.json());
		if (!payload.success) throw new Error('AI_PROVIDER_INVALID_RESPONSE');
		const deepSeekPayload = payload.data;
		const content = deepSeekPayload.choices[0].message.content;
		if (!content) throw new Error('AI_PROVIDER_INVALID_RESPONSE');
		let proposal: z.infer<typeof ModelProposalSchema>;
		try { proposal = ModelProposalSchema.parse(JSON.parse(content)); } catch { throw new Error('AI_PROVIDER_INVALID_RESPONSE'); }

		const action = AgentActionSchema.parse({
			id: crypto.randomUUID(), idempotencyKey: input.idempotencyKey, operation: 'propose',
			summary: proposal.summary, transactions: proposal.transactions, requiresConfirmation: false, createdAt: new Date().toISOString()
		});
		return { action, usedUnits: deepSeekPayload.usage?.total_tokens ?? 0 };
	}
}
