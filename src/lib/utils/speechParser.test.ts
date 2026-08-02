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

	it('ignora fechas, cantidades y separadores de miles que no son movimientos', () => {
		expect(parseSpeechBatch('El 1 de agosto gasté 30', defaultCategories, { date: '2026-08-01' }).map((draft) => draft.amount)).toEqual([30]);
		expect(parseSpeechBatch('Gasté 100 en 2 pasajes', defaultCategories, { date: '2026-08-01' }).map((draft) => draft.amount)).toEqual([100]);
		expect(parseSpeechBatch('Gasté 1,200 en alquiler', defaultCategories, { date: '2026-08-01' }).map((draft) => draft.amount)).toEqual([1200]);
	});

	it('determina el tipo por segmento cuando hay ingresos y gastos mezclados', () => {
		const drafts = parseSpeechBatch('Recibí 1000 de sueldo y gasté 20 en comida', defaultCategories, { date: '2026-08-01' });
		expect(drafts.map((draft) => ({ amount: draft.amount, type: draft.type, categoryId: draft.categoryId }))).toEqual([
			{ amount: 1000, type: 'income', categoryId: '6' },
			{ amount: 20, type: 'expense', categoryId: '1' }
		]);
	});

	it('marca las categorías desconocidas para una confirmación explícita', () => {
		const [draft] = parseSpeechBatch('Gasté 100 en medicina', defaultCategories, { date: '2026-08-01' });
		expect(draft).toMatchObject({ categoryCode: 'uncategorized', categoryId: '7', reviewReasons: ['category'] });
	});

	it('reconoce vocabulario inglés cuando el locale es en-US', () => {
		const drafts = parseSpeechBatch('I received 1,000 salary and spent 20 on food', defaultCategories, { date: '2026-08-01', locale: 'en-US' });
		expect(drafts.map((draft) => ({ amount: draft.amount, type: draft.type, categoryId: draft.categoryId }))).toEqual([
			{ amount: 1000, type: 'income', categoryId: '6' },
			{ amount: 20, type: 'expense', categoryId: '1' }
		]);
	});
});
