import { z } from 'zod';
import { CATEGORY_CODES } from '$lib/domain/category-codes';

/** El nivel determina si una herramienta puede tocar datos locales. */
export const AgentOperationSchema = z.enum(['query', 'simulate', 'propose', 'execute']);
export type AgentOperation = z.infer<typeof AgentOperationSchema>;

export const TransactionIntentSchema = z.object({
	type: z.enum(['income', 'expense']),
	amountMinor: z.number().int().positive(),
	currency: z.string().regex(/^[A-Z]{3}$/),
	categoryCode: z.enum(CATEGORY_CODES),
	date: z.string().datetime({ offset: true }),
	note: z.string().trim().max(500).optional()
});

/** Una propuesta no contiene acceso a IndexedDB ni es una autorización para escribir. */
export const AgentActionSchema = z.object({
	id: z.string().uuid(),
	idempotencyKey: z.string().uuid(),
	operation: AgentOperationSchema,
	summary: z.string().trim().min(1).max(500),
	transactions: z.array(TransactionIntentSchema).max(50).default([]),
	requiresConfirmation: z.boolean(),
	createdAt: z.string().datetime({ offset: true })
}).superRefine((action, context) => {
	if (action.operation === 'execute' && !action.requiresConfirmation) {
		context.addIssue({ code: 'custom', path: ['requiresConfirmation'], message: 'Una ejecución siempre requiere confirmación.' });
	}
	if (action.operation !== 'execute' && action.requiresConfirmation) {
		context.addIssue({ code: 'custom', path: ['requiresConfirmation'], message: 'Solo una ejecución requiere confirmación.' });
	}
});

export type TransactionIntent = z.infer<typeof TransactionIntentSchema>;
export type AgentAction = z.infer<typeof AgentActionSchema>;
