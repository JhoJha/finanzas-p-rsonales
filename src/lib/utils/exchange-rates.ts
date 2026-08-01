const FRANKFURTER_API_URL = 'https://api.frankfurter.dev/v2/rates';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

export type FrankfurterRate = {
	base: string;
	quote: string;
	rate: number;
	date: string;
};

/** Indica si ya corresponde consultar nuevamente las tasas diarias. */
export function shouldRefreshExchangeRates(lastUpdatedAt?: string, now = Date.now()): boolean {
	if (!lastUpdatedAt) return true;
	const lastUpdated = Date.parse(lastUpdatedAt);
	return Number.isNaN(lastUpdated) || now - lastUpdated >= ONE_DAY_MS;
}

/**
 * Convierte la respuesta de Frankfurter a la convención de la aplicación:
 * moneda extranjera -> cantidad equivalente en moneda base.
 */
export function ratesToBaseCurrency(rates: FrankfurterRate[], baseCurrency: string, currencies: string[]): Record<string, number> {
	const requested = new Set(currencies.map((currency) => currency.toUpperCase()));
	const base = baseCurrency.toUpperCase();
	const result: Record<string, number> = {};

	for (const item of rates) {
		const quote = item.quote?.toUpperCase();
		if (item.base?.toUpperCase() !== base || !quote || !requested.has(quote) || !Number.isFinite(item.rate) || item.rate <= 0) continue;
		result[quote] = 1 / item.rate;
	}

	return result;
}

export async function fetchExchangeRatesToBase(baseCurrency: string, currencies: string[]): Promise<Record<string, number>> {
	const base = baseCurrency.trim().toUpperCase();
	const quotes = [...new Set(currencies.map((currency) => currency.trim().toUpperCase()))].filter((currency) => currency && currency !== base);
	if (!quotes.length) return {};

	const url = new URL(FRANKFURTER_API_URL);
	url.searchParams.set('base', base);
	url.searchParams.set('quotes', quotes.join(','));
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') throw new Error('La consulta de tasas tardó demasiado. Intenta nuevamente.');
		throw error;
	} finally {
		clearTimeout(timeout);
	}
	if (!response.ok) throw new Error('No se pudo consultar el tipo de cambio.');
	const payload: unknown = await response.json();
	if (!Array.isArray(payload)) throw new Error('La respuesta del proveedor no es válida.');

	const converted = ratesToBaseCurrency(payload as FrankfurterRate[], base, quotes);
	if (Object.keys(converted).length !== quotes.length) throw new Error('El proveedor no devolvió todas las monedas solicitadas.');
	return converted;
}
