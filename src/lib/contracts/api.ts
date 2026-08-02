import { z } from 'zod';
import { AgentActionSchema } from '$lib/contracts/agent';
import { isValidTimeZone } from '$lib/domain/time-zone';

export const AiRequestSchema = z.object({
	source: z.enum(['voice', 'chat']),
	text: z.string().trim().min(1).max(4_000),
	locale: z.enum(['es-PE', 'en-US']),
	timeZone: z.string().trim().min(1).max(100).refine(isValidTimeZone, 'La zona horaria debe ser una zona IANA válida.'),
	currency: z.string().regex(/^[A-Z]{3}$/)
});

export const AiProposalResponseSchema = z.object({
	action: AgentActionSchema,
	remainingQuota: z.number().int().nonnegative().nullable()
});

export type AiRequest = z.infer<typeof AiRequestSchema>;
export type AiProposalResponse = z.infer<typeof AiProposalResponseSchema>;
