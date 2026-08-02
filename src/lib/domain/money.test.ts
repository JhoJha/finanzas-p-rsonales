import { describe, expect, it } from 'vitest';
import { fromMinorUnits, toMinorUnits } from '$lib/domain/money';
import { todayInTimeZone } from '$lib/utils/date';
import { parseSpeech } from '$lib/utils/speechParser';
import { defaultCategories } from '$lib/schema';
import { AgentActionSchema } from '$lib/contracts/agent';

describe('foundation for canonical financial data', () => {
	it('converts future agent amounts with the currency precision deterministically', () => {
		expect(toMinorUnits(30.25, 'PEN')).toBe(3025);
		expect(fromMinorUnits(3025, 'PEN')).toBe(30.25);
		expect(toMinorUnits(30, 'JPY')).toBe(30);
	});

	it('creates calendar dates in the configured zone without UTC day drift', () => {
		expect(todayInTimeZone('America/Lima', new Date('2026-08-02T02:30:00.000Z'))).toBe('2026-08-01');
	});

	it('keeps speech classification independent from legacy category IDs', () => {
		const parsed = parseSpeech('Gasté 12 soles en pasajes', defaultCategories);
		expect(parsed).toMatchObject({ amount: 12, type: 'expense', categoryCode: 'transport', categoryId: '2' });
	});

	it('never accepts an agent execution without explicit confirmation', () => {
		const action = {
			id: '7c4055ec-f196-49cc-9c9b-b2591d3d69c0', idempotencyKey: 'e9c4cf5a-2bb9-47ba-934d-3de40c695acb', operation: 'execute',
			summary: 'Registrar un gasto', transactions: [], requiresConfirmation: false, createdAt: '2026-08-01T12:00:00.000Z'
		};
		expect(AgentActionSchema.safeParse(action).success).toBe(false);
		expect(AgentActionSchema.safeParse({ ...action, requiresConfirmation: true }).success).toBe(true);
	});
});
