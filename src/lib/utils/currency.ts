import { financeStore } from '$lib/store.svelte';
import { resolveLocale } from '$lib/i18n';

export function formatCurrency(amount: number, currencyCode?: string, locale?: string): string {
	// If financeStore is not ready or settings is undefined, fallback to PEN
	const code = currencyCode || financeStore?.settings?.baseCurrency || 'PEN';
	
	try {
		return new Intl.NumberFormat(resolveLocale(locale ?? financeStore?.settings?.locale), {
			style: 'currency',
			currency: code
		}).format(amount);
	} catch (e) {
		// Fallback for invalid currency codes
		return `${code} ${amount.toFixed(2)}`;
	}
}

export function convertToBaseCurrency(amount: number, fromCurrency?: string): number {
	const settings = financeStore?.settings;
	if (!settings) return amount;
	
	const from = fromCurrency || 'PEN';
	const base = settings.baseCurrency;
	
	if (from === base) return amount;
	
	// Assume exchangeRates map "fromCurrency -> how much it is worth in baseCurrency"
	// Example: base = PEN, from = USD, rate = 3.75 -> 1 USD = 3.75 PEN
	// If from = PEN, base = USD, rate = 0.26 -> 1 PEN = 0.26 USD
	// We'll store exchangeRates relative to the baseCurrency.
	const rate = settings.exchangeRates[from];
	if (!rate) return amount;
	
	return amount * rate;
}
