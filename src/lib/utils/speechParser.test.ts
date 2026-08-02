import { describe, expect, it } from 'vitest';
import { defaultCategories } from '$lib/schema';
import { parseSpeechBatch } from '$lib/utils/speechParser';

describe('parseSpeechBatch', () => {
	it('separa varios movimientos y clasifica cada detalle', () => {
		const drafts = parseSpeechBatch('Hoy gasté 30 soles en hotel, 12 en comida y 20 en pasajes.', defaultCategories, { date: '2026-08-01' });

		expect(drafts).toHaveLength(3);
		expect(drafts.map((draft) => ({ amount: draft.amount, categoryId: draft.categoryId, type: draft.type }))).toEqual([
			{ amount: 30, categoryId: '3', type: 'expense' },
			{ amount: 12, categoryId: '1', type: 'expense' },
			{ amount: 20, categoryId: '2', type: 'expense' }
		]);
	});

	it('preserva la fecha de calendario cuando el dictado dice ayer', () => {
		const [draft] = parseSpeechBatch('Ayer recibí 1200 de sueldo', defaultCategories, { date: '2026-08-01' });
		expect(draft).toMatchObject({ amount: 1200, categoryId: '6', type: 'income', date: '2026-07-31' });
	});
});
