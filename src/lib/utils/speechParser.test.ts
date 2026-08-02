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
		expect(draft).toMatchObject({ categoryCode: 'health', categoryId: '9', reviewReasons: [] });
	});

	it('reconoce vocabulario inglés cuando el locale es en-US', () => {
		const drafts = parseSpeechBatch('I received 1,000 salary and spent 20 on food', defaultCategories, { date: '2026-08-01', locale: 'en-US' });
		expect(drafts.map((draft) => ({ amount: draft.amount, type: draft.type, categoryId: draft.categoryId }))).toEqual([
			{ amount: 1000, type: 'income', categoryId: '6' },
			{ amount: 20, type: 'expense', categoryId: '1' }
		]);
	});

	it('convierte montos hablados en español, incluidos miles y céntimos', () => {
		const drafts = parseSpeechBatch('Gasté treinta soles en almuerzo, mil doscientos con cincuenta en alquiler y veinte en pasajes', defaultCategories, { date: '2026-08-01' });
		expect(drafts.map((draft) => ({ amount: draft.amount, categoryId: draft.categoryId }))).toEqual([
			{ amount: 30, categoryId: '1' },
			{ amount: 1200.5, categoryId: '3' },
			{ amount: 20, categoryId: '2' }
		]);
	});

	it('convierte montos hablados en inglés sin interpretar una fecha como gasto', () => {
		const drafts = parseSpeechBatch('On the first of August I spent thirty dollars on food and one thousand two hundred on rent', defaultCategories, { date: '2026-08-01', locale: 'en-US' });
		expect(drafts.map((draft) => ({ amount: draft.amount, categoryId: draft.categoryId, type: draft.type }))).toEqual([
			{ amount: 30, categoryId: '1', type: 'expense' },
			{ amount: 1200, categoryId: '3', type: 'expense' }
		]);
	});

	it('separa un dictado compuesto sin confundir cantidad de artículos con importe', () => {
		const drafts = parseSpeechBatch('Acabo de ir a la panadería, compré dos soles de pan, compré un sol de queso, me compré un helado y me costó dos soles, gasté tres soles en moto, luego mi abuela me dio cinco soles de propina', defaultCategories, { date: '2026-08-01' });
		expect(drafts.map((draft) => ({ amount: draft.amount, type: draft.type, categoryId: draft.categoryId, note: draft.note }))).toEqual([
			{ amount: 2, type: 'expense', categoryId: '1', note: 'pan' },
			{ amount: 1, type: 'expense', categoryId: '1', note: 'queso' },
			{ amount: 2, type: 'expense', categoryId: '1', note: 'helado' },
			{ amount: 3, type: 'expense', categoryId: '2', note: 'moto' },
			{ amount: 5, type: 'income', categoryId: '6', note: 'propina' }
		]);
	});

	it('clasifica comercios de suscripción conocidos sin asumir que Amazon es una suscripción', () => {
		const [netflix] = parseSpeechBatch('Pagué 25 soles de Netflix', defaultCategories, { date: '2026-08-01' });
		const [amazon] = parseSpeechBatch('Pagué 25 soles en Amazon', defaultCategories, { date: '2026-08-01' });
		expect(netflix).toMatchObject({ categoryCode: 'subscriptions', categoryId: '8', reviewReasons: [] });
		expect(amazon).toMatchObject({ categoryCode: 'uncategorized', categoryId: '7', reviewReasons: ['category'] });
	});

	it('prioriza una regla personal confirmada dos veces sin enviarla fuera del dispositivo', () => {
		const [draft] = parseSpeechBatch('Gasté 2 soles en Cuates', defaultCategories, { date: '2026-08-01', rules: [{ id: 'rule-cuates', phrase: 'Cuates', categoryId: '1', type: 'expense', locale: 'es-PE', confidence: 2, enabled: true, createdAt: '2026-08-01T12:00:00.000Z' }] });
		expect(draft).toMatchObject({ categoryId: '1', categoryCode: 'food', reviewReasons: [] });
	});

	it('extrae contraparte, fuente y explicación de un ingreso', () => {
		const [draft] = parseSpeechBatch('Mi abuela me dio 5 soles de propina', defaultCategories, { date: '2026-08-01' });
		expect(draft).toMatchObject({ type: 'income', categoryId: '6', counterparty: 'Abuela', incomeSource: 'gift' });
		expect(draft.explanation.length).toBeGreaterThan(0);
	});

	it('preserva ceros y posiciones en decimales hablados', () => {
		expect(parseSpeechBatch('Gasté treinta coma cinco soles en comida', defaultCategories, { date: '2026-08-01' })[0].amount).toBe(30.5);
		expect(parseSpeechBatch('I spent thirty point zero five dollars on food', defaultCategories, { date: '2026-08-01', locale: 'en-US' })[0].amount).toBe(30.05);
	});

	it('aplica una regla válida a una categoría personalizada sin dejarla pendiente', () => {
		const custom = { id: 'custom-food', name: 'Antojitos', icon: 'tag', color: 'bg-orange-500', type: 'expense' as const };
		const [draft] = parseSpeechBatch('Gasté 2 soles en mi antojito', [...defaultCategories, custom], { date: '2026-08-01', rules: [{ id: 'rule-custom', phrase: 'antojito', categoryId: custom.id, type: 'expense', locale: 'es-PE', confidence: 2, enabled: true, createdAt: '2026-08-01T12:00:00.000Z' }] });
		expect(draft).toMatchObject({ categoryId: custom.id, categoryCode: 'custom', reviewReasons: [] });
	});

	it('no aplica reglas por una subcadena dentro de otra palabra', () => {
		const [draft] = parseSpeechBatch('Gasté 20 soles en pantalón', defaultCategories, { date: '2026-08-01', rules: [{ id: 'rule-pan', phrase: 'pan', categoryId: '1', type: 'expense', locale: 'es-PE', confidence: 2, enabled: true, createdAt: '2026-08-01T12:00:00.000Z' }] });
		expect(draft).toMatchObject({ categoryCode: 'clothing', categoryId: '11' });
	});
});
