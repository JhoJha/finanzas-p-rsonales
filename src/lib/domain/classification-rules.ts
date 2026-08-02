import type { PersonalClassificationRule } from '$lib/schema';

export function normalizeClassificationText(value: string): string {
	return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Las reglas personales requieren dos confirmaciones antes de aplicarse solas. */
export function findLearnedRule(text: string, locale: string, rules: PersonalClassificationRule[]): PersonalClassificationRule | undefined {
	const normalized = ` ${normalizeClassificationText(text)} `;
	return rules
		.filter((rule) => rule.enabled && rule.confidence >= 2 && (!rule.locale || rule.locale === locale) && normalized.includes(` ${normalizeClassificationText(rule.phrase)} `))
		.sort((a, b) => b.confidence - a.confidence || b.phrase.length - a.phrase.length)[0];
}
