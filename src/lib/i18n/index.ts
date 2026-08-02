import { DEFAULT_TIME_ZONE, resolveTimeZone as resolveKnownTimeZone } from '$lib/domain/time-zone';

export const SUPPORTED_LOCALES = ['es-PE', 'en-US'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'es-PE';
export { DEFAULT_TIME_ZONE };

export const TIME_ZONE_OPTIONS = [
	{ value: 'America/Lima', label: 'Lima (UTC-5)' },
	{ value: 'America/New_York', label: 'New York (UTC-5/-4)' },
	{ value: 'Europe/Madrid', label: 'Madrid (UTC+1/+2)' }
] as const;

type MessageKey = 'category.uncategorized' | 'transaction.income' | 'transaction.expense' | 'transaction.transfer';

const messages: Record<SupportedLocale, Record<MessageKey, string>> = {
	'es-PE': {
		'category.uncategorized': 'Sin categoría',
		'transaction.income': 'Ingreso',
		'transaction.expense': 'Gasto',
		'transaction.transfer': 'Transferencia'
	},
	'en-US': {
		'category.uncategorized': 'Uncategorized',
		'transaction.income': 'Income',
		'transaction.expense': 'Expense',
		'transaction.transfer': 'Transfer'
	}
};

const categoryLabels: Record<SupportedLocale, Partial<Record<string, string>>> = {
	'es-PE': {
		food: 'Alimentación', transport: 'Transporte', housing: 'Vivienda', education: 'Educación',
		entertainment: 'Ocio', uncategorized: 'Por clasificar', income: 'Trabajo / Ingresos', debt_payment: 'Pago de deuda', savings: 'Ahorro / Meta'
	},
	'en-US': {
		food: 'Food', transport: 'Transport', housing: 'Housing', education: 'Education',
		entertainment: 'Entertainment', uncategorized: 'Uncategorized', income: 'Work / Income', debt_payment: 'Debt payment', savings: 'Savings / Goal'
	}
};

export function resolveLocale(locale?: string): SupportedLocale {
	return SUPPORTED_LOCALES.includes(locale as SupportedLocale) ? locale as SupportedLocale : DEFAULT_LOCALE;
}

export function resolveTimeZone(timeZone?: string): string {
	return resolveKnownTimeZone(timeZone);
}

export function translate(key: MessageKey, locale?: string): string {
	return messages[resolveLocale(locale)][key];
}

/** Las categorías personalizadas conservan el nombre que eligió la persona. */
export function categoryDisplayName(category: { code?: string; name: string } | undefined, locale?: string): string {
	if (!category) return translate('category.uncategorized', locale);
	return category.code ? categoryLabels[resolveLocale(locale)][category.code] ?? category.name : category.name;
}

/** Las fechas YYYY-MM-DD son fechas de calendario, no instantes: se formatean en UTC para no desplazarlas. */
export function formatCalendarDate(value: string, locale?: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return value;
	const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
	return new Intl.DateTimeFormat(resolveLocale(locale), { ...options, timeZone: 'UTC' }).format(date);
}
