import { defaultCategories, type Category } from '../schema';
import { categoryCodeForLegacyId, type CategoryCode } from '$lib/domain/category-codes';
import { dateFromDateOnly, formatDateOnly } from '$lib/utils/date';

export type SpeechReviewReason = 'type' | 'category';

export type SpeechTransactionDraft = {
	id: string;
	amount: number;
	categoryCode: CategoryCode;
	categoryId: string;
	type: 'income' | 'expense';
	note: string;
	date: string;
	reviewReasons: SpeechReviewReason[];
};

type ParserLocale = 'es-PE' | 'en-US';
type ActionType = 'income' | 'expense';

const MONEY_NUMBER = /(?<!\d)(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?!\d)/g;
const CURRENCY_AFTER = /^\s*(?:s\/?\.?|soles?|pen|\$|usd|dollars?)\b/i;
const CURRENCY_BEFORE = /(?:s\/?\.?|pen|\$|usd)\s*$/i;
const CONTINUATION_DETAIL = /^\s*(?:en|para|de|on|for|at|in)\b/i;

const language = {
	'es-PE': {
		income: ['ingrese', 'gane', 'recibi', 'cobre', 'me pagaron', 'sueldo', 'salario', 'venta'],
		expense: ['gaste', 'pague', 'compre', 'costo', 'debite'],
		yesterday: ['ayer'],
		categories: {
			food: ['comida', 'almuerzo', 'desayuno', 'cena', 'restaurante', 'pizza', 'hamburguesa', 'supermercado', 'mercado', 'cafe'],
			transport: ['pasaje', 'pasajes', 'taxi', 'transporte', 'bus', 'gasolina', 'uber', 'tren', 'metro'],
			housing: ['alquiler', 'luz', 'agua', 'internet', 'casa', 'mantenimiento', 'hotel', 'hospedaje'],
			education: ['colegio', 'universidad', 'curso', 'libro', 'cuaderno', 'pension'],
			entertainment: ['cine', 'juego', 'salida', 'cerveza', 'fiesta', 'ocio', 'entretenimiento']
		}
	},
	'en-US': {
		income: ['received', 'earned', 'got paid', 'salary', 'paycheck', 'sold'],
		expense: ['spent', 'paid', 'bought', 'cost', 'charged'],
		yesterday: ['yesterday'],
		categories: {
			food: ['food', 'lunch', 'breakfast', 'dinner', 'restaurant', 'pizza', 'hamburger', 'groceries', 'coffee'],
			transport: ['fare', 'ticket', 'taxi', 'transport', 'bus', 'gas', 'uber', 'train', 'subway'],
			housing: ['rent', 'electricity', 'water', 'internet', 'home', 'maintenance', 'hotel', 'lodging'],
			education: ['school', 'university', 'course', 'book', 'notebook', 'tuition'],
			entertainment: ['movie', 'game', 'outing', 'beer', 'party', 'leisure', 'entertainment']
		}
	}
} as const;

function categoryIdForCode(categories: Category[], code: CategoryCode, type: ActionType): string {
	return categories.find((category) => category.code === code && category.type === type)?.id
		?? categories.find((category) => categoryCodeForLegacyId(category.id) === code && category.type === type)?.id
		?? (code === 'uncategorized' ? '7' : undefined)
		?? categories.find((category) => category.type === type && !category.id.startsWith('__'))?.id
		?? (type === 'income' ? '6' : '7');
}

function normalized(value: string): string {
	return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function lastActionIn(text: string, locale: ParserLocale): ActionType | null {
	const value = normalized(text);
	let lastIncome = -1;
	let lastExpense = -1;
	for (const phrase of language[locale].income) lastIncome = Math.max(lastIncome, value.lastIndexOf(phrase));
	for (const phrase of language[locale].expense) lastExpense = Math.max(lastExpense, value.lastIndexOf(phrase));
	if (lastIncome < 0 && lastExpense < 0) return null;
	return lastIncome > lastExpense ? 'income' : 'expense';
}

function categoryCodeForText(text: string, type: ActionType, locale: ParserLocale): CategoryCode | null {
	if (type === 'income') return 'income';
	const value = normalized(text);
	for (const [code, keywords] of Object.entries(language[locale].categories) as [Exclude<CategoryCode, 'income' | 'debt_payment' | 'savings' | 'uncategorized'>, readonly string[]][]) {
		if (keywords.some((keyword) => value.includes(keyword))) return code;
	}
	return null;
}

function dateForText(text: string, defaultDate: string, locale: ParserLocale): string {
	if (!language[locale].yesterday.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(text))) return defaultDate;
	const yesterday = dateFromDateOnly(defaultDate);
	yesterday.setDate(yesterday.getDate() - 1);
	return formatDateOnly(yesterday);
}

function parseLocalizedAmount(raw: string): number | null {
	const lastComma = raw.lastIndexOf(',');
	const lastDot = raw.lastIndexOf('.');
	let normalizedAmount = raw;
	if (lastComma >= 0 && lastDot >= 0) {
		const decimal = lastComma > lastDot ? ',' : '.';
		normalizedAmount = raw.replace(decimal === ',' ? /\./g : /,/g, '').replace(decimal, '.');
	} else if (lastComma >= 0 || lastDot >= 0) {
		const separator = lastComma >= 0 ? ',' : '.';
		const trailing = raw.length - raw.lastIndexOf(separator) - 1;
		normalizedAmount = trailing === 3 ? raw.replace(/[.,]/g, '') : raw.replace(',', '.');
	}
	const amount = Number(normalizedAmount);
	return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function noteForSegment(segment: string, fullText: string): string {
	const note = segment
		.replace(CURRENCY_AFTER, '')
		.replace(/^\s*(?:en|para|de|on|for|at|in)\s+/i, '')
		.replace(/\s+(?:y|e|and)\s*$/i, '')
		.replace(/[,.؛;]+$/g, '')
		.trim();
	return note || fullText.trim();
}

/**
 * Separa únicamente montos con contexto monetario. Los tipos y categorías que
 * no se puedan inferir se devuelven con una razón explícita de revisión.
 */
export function parseSpeechBatch(
	text: string,
	categories: Category[] = defaultCategories,
	options: { date: string; locale?: ParserLocale } = { date: formatDateOnly(new Date()) }
): SpeechTransactionDraft[] {
	const locale = options.locale ?? 'es-PE';
	const matches = [...text.matchAll(MONEY_NUMBER)];
	const drafts: SpeechTransactionDraft[] = [];
	let previousAcceptedEnd = 0;

	for (let index = 0; index < matches.length; index += 1) {
		const match = matches[index];
		const amount = parseLocalizedAmount(match[0]);
		if (!amount) continue;
		const start = match.index ?? 0;
		const end = start + match[0].length;
		const nextStart = matches[index + 1]?.index ?? text.length;
		const before = text.slice(previousAcceptedEnd, start);
		const after = text.slice(end, nextStart);
		const action = lastActionIn(before, locale);
		const hasCurrency = CURRENCY_BEFORE.test(before) || CURRENCY_AFTER.test(after);
		const isContinuation = drafts.length > 0 && CONTINUATION_DETAIL.test(after);
		if (!action && !hasCurrency && !isContinuation) continue;

		const inheritedType = drafts.at(-1)?.type;
		const type = action ?? inheritedType ?? 'expense';
		const categoryCode = categoryCodeForText(after, type, locale) ?? 'uncategorized';
		const reviewReasons: SpeechReviewReason[] = [
			...(action || inheritedType ? [] : ['type' as const]),
			...(categoryCode === 'uncategorized' ? ['category' as const] : [])
		];
		drafts.push({
			id: `speech-${drafts.length}`,
			amount,
			categoryCode,
			categoryId: categoryIdForCode(categories, categoryCode, type),
			type,
			note: noteForSegment(after, text),
			date: dateForText(text, options.date, locale),
			reviewReasons
		});
		previousAcceptedEnd = end;
	}
	return drafts;
}

/** Compatibilidad para los consumidores que solamente necesitan el primer movimiento. */
export function parseSpeech(text: string, categories: Category[] = defaultCategories) {
	const [first] = parseSpeechBatch(text, categories);
	return first
		? { amount: first.amount, categoryCode: first.categoryCode, categoryId: first.categoryId, type: first.type, note: text }
		: { amount: null, categoryCode: 'uncategorized' as CategoryCode, categoryId: categoryIdForCode(categories, 'uncategorized', 'expense'), type: 'expense' as const, note: text };
}
