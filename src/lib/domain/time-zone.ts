export const DEFAULT_TIME_ZONE = 'America/Lima';

/** Verifica una zona IANA con la misma implementación que consumirá Intl. */
export function isValidTimeZone(value: string): boolean {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
		return true;
	} catch {
		return false;
	}
}

export function resolveTimeZone(timeZone?: string): string {
	return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}
