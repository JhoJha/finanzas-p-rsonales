/** Normaliza fechas de calendario sin añadir una zona horaria. */
export function toDateOnly(value: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
	if (match) return match[0];

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return formatDateOnly(date);
}

/** Convierte una fecha/hora ISO en la fecha de calendario de una zona concreta. */
export function toDateOnlyInTimeZone(value: string, timeZone: string): string {
	const directDate = /^(\d{4}-\d{2}-\d{2})$/.exec(value);
	if (directDate) return directDate[1];
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return todayInTimeZone(timeZone, date);
}

/** Crea una fecha a medianoche local para vencimientos y recurrencias. */
export function dateFromDateOnly(value: string): Date {
	const [year, month, day] = toDateOnly(value).split('-').map(Number);
	return new Date(year, month - 1, day);
}

export function formatDateOnly(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/** Fecha de calendario en la zona configurada, sin convertirla a UTC. */
export function todayInTimeZone(timeZone: string, now = new Date()): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);
	const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
	return `${value('year')}-${value('month')}-${value('day')}`;
}

/**
 * Representa el mediodía de una fecha de calendario en la zona indicada. El
 * instante resultante se almacena en ISO sin cambiar el día que eligió la persona.
 */
export function dateTimeFromDateOnly(value: string, timeZone: string): string {
	const [year, month, day] = toDateOnly(value).split('-').map(Number);
	const intendedUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
	const offsetAtNoon = timeZoneOffsetAt(new Date(intendedUtc), timeZone);
	return new Date(intendedUtc - offsetAtNoon).toISOString();
}

function timeZoneOffsetAt(date: Date, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
	}).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
	return Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second')) - date.getTime();
}
