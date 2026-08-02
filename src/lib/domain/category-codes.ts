/** Códigos estables, independientes de idioma, para las categorías incluidas. */
export const CATEGORY_CODES = [
	'food',
	'transport',
	'housing',
	'education',
	'entertainment',
	'subscriptions',
	'uncategorized',
	'income',
	'debt_payment',
	'savings'
] as const;

export type CategoryCode = (typeof CATEGORY_CODES)[number];

/** IDs históricos de las categorías preinstaladas. */
export const LEGACY_CATEGORY_CODE_BY_ID: Readonly<Record<string, CategoryCode>> = {
	'1': 'food',
	'2': 'transport',
	'3': 'housing',
	'4': 'education',
	'5': 'entertainment',
	'8': 'subscriptions',
	'7': 'uncategorized',
	'6': 'income',
	'__debt-payment__': 'debt_payment',
	'__savings__': 'savings'
};

export function categoryCodeForLegacyId(id: string): CategoryCode | undefined {
	return LEGACY_CATEGORY_CODE_BY_ID[id];
}
