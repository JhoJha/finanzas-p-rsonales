/** Normaliza fechas de calendario sin añadir una zona horaria. */
export function toDateOnly(value: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
	if (match) return match[0];

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return formatDateOnly(date);
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
