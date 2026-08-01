import type { Category, ImportRow, ImportRule } from '$lib/schema';

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
const MERCHANT_NOISE = /\b(?:compra|consumo|pago|pos|visa|mastercard|debito|credito|online|pe|peru)\b/gi;

export function normalizeMerchant(value: string): string {
	return value
		.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.replace(/\d{3,}/g, ' ').replace(MERCHANT_NOISE, ' ')
		.replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
		.slice(0, 120) || 'MOVIMIENTO';
}

function parseDelimited(text: string): string[][] {
	const delimiter = (text.match(/;/g)?.length ?? 0) > (text.match(/,/g)?.length ?? 0) ? ';' : ',';
	const rows: string[][] = [];
	let row: string[] = [], cell = '', quoted = false;
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (char === '"') {
			if (quoted && text[i + 1] === '"') { cell += char; i++; } else quoted = !quoted;
		} else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = ''; }
		else if ((char === '\n' || char === '\r') && !quoted) {
			if (char === '\r' && text[i + 1] === '\n') i++;
			row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = '';
		} else cell += char;
	}
	row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
	return rows;
}

function columnIndex(headers: string[], patterns: RegExp[]): number {
	return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

/** Interpreta separadores latinos e ingleses, espacios y negativos entre paréntesis. */
export function parseImportAmount(value: string): number | null {
	let input = value.trim();
	if (!input) return null;
	const parenthesized = /^\(.*\)$/.test(input);
	input = input.replace(/[()\s']/g, '').replace(/[^0-9,.-]/g, '');
	const negative = parenthesized || input.startsWith('-');
	input = input.replace(/-/g, '');
	if (!input || !/\d/.test(input)) return null;

	const lastComma = input.lastIndexOf(',');
	const lastDot = input.lastIndexOf('.');
	let decimalSeparator = '';
	if (lastComma >= 0 && lastDot >= 0) decimalSeparator = lastComma > lastDot ? ',' : '.';
	else if (lastComma >= 0) decimalSeparator = input.length - lastComma - 1 <= 2 ? ',' : '';
	else if (lastDot >= 0) decimalSeparator = input.length - lastDot - 1 <= 2 ? '.' : '';

	let normalized: string;
	if (decimalSeparator) {
		const grouping = decimalSeparator === ',' ? /\./g : /,/g;
		normalized = input.replace(grouping, '').replace(decimalSeparator, '.');
	} else {
		normalized = input.replace(/[.,]/g, '');
	}
	const amount = Number(normalized);
	return Number.isFinite(amount) && amount !== 0 ? (negative ? -amount : amount) : null;
}

export interface ImportParseResult {
	rows: ImportRow[];
	skipped: number;
}

export function parseImportCsvWithDiagnostics(text: string, categories: Category[], rules: ImportRule[]): ImportParseResult {
	const table = parseDelimited(text.replace(/^\uFEFF/, ''));
	if (table.length < 2) throw new Error('El archivo debe incluir encabezados y al menos un movimiento.');
	const headers = table[0].map((cell) => normalizeMerchant(cell).toLowerCase());
	const dateIndex = columnIndex(headers, [/fecha/, /date/]);
	const debitIndex = columnIndex(headers, [/debe/, /debito/, /cargo/]);
	const creditIndex = columnIndex(headers, [/haber/, /credito/, /abono/]);
	const amountIndex = columnIndex(headers, [/monto/, /importe/, /amount/, /valor/]);
	const descriptionIndex = columnIndex(headers, [/descripcion/, /detalle/, /concepto/, /comercio/, /merchant/, /glosa/]);
	if (dateIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0) || descriptionIndex < 0) throw new Error('No se detectaron Fecha, Monto (o Debe/Haber) y Descripción. Usa esos encabezados en tu CSV.');

	let skipped = 0;
	const rows = table.slice(1, 501).flatMap((cells, index) => {
		const directAmount = amountIndex >= 0 ? parseImportAmount(cells[amountIndex] || '') : null;
		const debit = debitIndex >= 0 ? parseImportAmount(cells[debitIndex] || '') : null;
		const credit = creditIndex >= 0 ? parseImportAmount(cells[creditIndex] || '') : null;
		const amount = amountIndex >= 0 ? directAmount : (credit === null ? 0 : Math.abs(credit)) - (debit === null ? 0 : Math.abs(debit));
		const description = (cells[descriptionIndex] || '').trim();
		if (!description || amount === null || !Number.isFinite(amount) || amount === 0) { skipped++; return []; }
		const merchant = normalizeMerchant(description);
		const rule = rules.find((item) => merchant.includes(normalizeMerchant(item.merchant)));
		const fallback = categories.find((category) => category.type === (amount < 0 ? 'expense' : 'income') && merchant.includes(normalizeMerchant(category.name)));
		return [{ id: `row-${index}`, date: (cells[dateIndex] || '').trim(), amount, description, merchant, categoryId: rule?.categoryId ?? fallback?.id, duplicate: false, selected: true }];
	});
	return { rows, skipped };
}

export function parseImportCsv(text: string, categories: Category[], rules: ImportRule[]): ImportRow[] {
	return parseImportCsvWithDiagnostics(text, categories, rules).rows;
}

export function importRowDuplicateKey(row: Pick<ImportRow, 'date' | 'amount' | 'merchant'>): string {
	return `${row.date.slice(0, 10)}|${Math.abs(row.amount).toFixed(2)}|${row.merchant}`;
}

export function parseBankDate(value: string): Date | null {
	const trimmed = value.trim();
	const local = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
	if (local) {
		const [, day, month, year] = local;
		const fullYear = year.length === 2 ? `20${year}` : year;
		const parsed = new Date(Number(fullYear), Number(month) - 1, Number(day), 12);
		return Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(fullYear) || parsed.getMonth() !== Number(month) - 1 || parsed.getDate() !== Number(day) ? null : parsed;
	}
	const parsed = new Date(trimmed);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}
