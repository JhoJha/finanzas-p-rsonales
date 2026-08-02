export const SUPPORTED_LOCALES = ['es-PE', 'en-US'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'es-PE';
export const DEFAULT_TIME_ZONE = 'America/Lima';

export function resolveLocale(locale?: string): SupportedLocale {
	return SUPPORTED_LOCALES.includes(locale as SupportedLocale) ? locale as SupportedLocale : DEFAULT_LOCALE;
}

export function resolveTimeZone(timeZone?: string): string {
	if (!timeZone) return DEFAULT_TIME_ZONE;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone }).format();
		return timeZone;
	} catch {
		return DEFAULT_TIME_ZONE;
	}
}
