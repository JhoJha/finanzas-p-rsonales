import { defaultCategories, type Category } from '../schema';
import { categoryCodeForLegacyId, type CategoryCode } from '$lib/domain/category-codes';
import { dateFromDateOnly, formatDateOnly } from '$lib/utils/date';

export type SpeechTransactionDraft = {
	id: string;
	amount: number;
	categoryCode: CategoryCode;
	categoryId: string;
	type: 'income' | 'expense';
	note: string;
	date: string;
};

function categoryIdForCode(categories: Category[], code: CategoryCode, type: 'income' | 'expense'): string {
	return categories.find((category) => category.code === code && category.type === type)?.id
		?? categories.find((category) => categoryCodeForLegacyId(category.id) === code && category.type === type)?.id
		?? categories.find((category) => category.type === type && !category.id.startsWith('__'))?.id
		?? (type === 'income' ? '6' : '1');
}

const categoryKeywords: Record<Exclude<CategoryCode, 'income' | 'debt_payment' | 'savings'>, string[]> = {
	food: ['comida', 'almuerzo', 'desayuno', 'cena', 'restaurante', 'pizza', 'hamburguesa', 'supermercado', 'mercado', 'café', 'cafe'],
	transport: ['pasaje', 'pasajes', 'taxi', 'transporte', 'bus', 'gasolina', 'uber', 'tren', 'metro'],
	housing: ['alquiler', 'luz', 'agua', 'internet', 'casa', 'mantenimiento', 'hotel', 'hospedaje'],
	education: ['colegio', 'universidad', 'curso', 'libro', 'cuaderno', 'pensión', 'pension'],
	entertainment: ['cine', 'juego', 'salida', 'cerveza', 'fiesta', 'ocio', 'entretenimiento']
};

function normalized(value: string): string {
	return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function typeForText(text: string): 'income' | 'expense' {
	const value = normalized(text);
	return /\b(ingrese|gane|recibi|cobre|sueldo|salario|venta|me pagaron)\b/.test(value) ? 'income' : 'expense';
}

function categoryCodeForText(text: string, type: 'income' | 'expense'): CategoryCode {
	if (type === 'income') return 'income';
	const value = normalized(text);
	for (const [code, keywords] of Object.entries(categoryKeywords) as [keyof typeof categoryKeywords, string[]][]) {
		if (keywords.some((keyword) => value.includes(keyword))) return code;
	}
	return 'food';
}

function dateForText(text: string, defaultDate: string): string {
	if (!/\bayer\b/i.test(text)) return defaultDate;
	const yesterday = dateFromDateOnly(defaultDate);
	yesterday.setDate(yesterday.getDate() - 1);
	return formatDateOnly(yesterday);
}

function noteForSegment(segment: string, fullText: string): string {
	const note = segment
		.replace(/^\s*(?:soles?|s\/?\.?|pen)\b/i, '')
		.replace(/^\s*(?:en|para|de)\s+/i, '')
		.replace(/\s+(?:y|e)\s*$/i, '')
		.replace(/[,.؛;]+$/g, '')
		.trim();
	return note || fullText.trim();
}

/**
 * Separa un dictado en movimientos candidatos. Es deliberadamente determinista:
 * no hace llamadas de red y nunca guarda ni modifica el estado financiero.
 */
export function parseSpeechBatch(
	text: string,
	categories: Category[] = defaultCategories,
	options: { date: string } = { date: formatDateOnly(new Date()) }
): SpeechTransactionDraft[] {
	const matches = [...text.matchAll(/\b(\d+(?:[.,]\d{1,2})?)\b/g)];
	if (!matches.length) return [];

	const type = typeForText(text);
	const date = dateForText(text, options.date);
	return matches.flatMap((match, index) => {
		const rawAmount = match[1].replace(',', '.');
		const amount = Number.parseFloat(rawAmount);
		if (!Number.isFinite(amount) || amount <= 0) return [];
		const afterAmount = (match.index ?? 0) + match[0].length;
		const nextAmountAt = matches[index + 1]?.index ?? text.length;
		const note = noteForSegment(text.slice(afterAmount, nextAmountAt), text);
		const categoryCode = categoryCodeForText(note, type);
		return [{
			id: `speech-${index}`,
			amount,
			categoryCode,
			categoryId: categoryIdForCode(categories, categoryCode, type),
			type,
			note,
			date
		}];
	});
}

/** Compatibilidad para los consumidores que solamente necesitan el primer movimiento. */
export function parseSpeech(text: string, categories: Category[] = defaultCategories) {
	const [first] = parseSpeechBatch(text, categories);
	return first
		? { amount: first.amount, categoryCode: first.categoryCode, categoryId: first.categoryId, type: first.type, note: text }
		: { amount: null, categoryCode: 'food' as CategoryCode, categoryId: categoryIdForCode(categories, 'food', 'expense'), type: 'expense' as const, note: text };
}
