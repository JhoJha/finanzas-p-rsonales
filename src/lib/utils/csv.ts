import { financeStore } from '$lib/store.svelte';
import { categoryDisplayName, resolveLocale, translate } from '$lib/i18n';

function csvCell(value: string | number): string {
	return `"${String(value).replace(/"/g, '""')}"`;
}

/** Exportación apta para Excel que conserva la tasa usada por cada movimiento. */
export function exportTransactionsToCSV() {
	const locale = resolveLocale(financeStore.settings.locale);
	const headers = locale === 'en-US'
		? ['Date', 'Account', 'Account currency', 'Category', 'Type', 'Original amount', 'Historical rate', 'Base currency amount', 'Note']
		: ['Fecha', 'Cuenta', 'Moneda cuenta', 'Categoría', 'Tipo', 'Monto original', 'Tasa histórica', 'Monto en moneda base', 'Nota'];

	const rows = financeStore.transactions.map((transaction) => {
		const date = new Date(transaction.timestamp || transaction.date);
		const account = financeStore.accounts.find((item) => item.id === transaction.accountId);
		const category = financeStore.categories.find((item) => item.id === transaction.categoryId);
		const type = translate(`transaction.${transaction.type}` as 'transaction.income' | 'transaction.expense' | 'transaction.transfer', locale);

		return [
			date.toLocaleDateString(locale, { timeZone: financeStore.settings.timeZone }) + ' ' + date.toLocaleTimeString(locale, { timeZone: financeStore.settings.timeZone, hour: '2-digit', minute: '2-digit' }),
			account?.name || (locale === 'en-US' ? 'Unknown' : 'Desconocida'),
			account?.currency || financeStore.settings.baseCurrency,
			categoryDisplayName(category, locale),
			type,
			transaction.amount,
			transaction.exchangeRate ?? '',
			financeStore.getTransactionAmountInBase(transaction).toFixed(2),
			transaction.note || ''
		].map(csvCell).join(',');
	});

	return '\uFEFF' + [headers.map(csvCell).join(','), ...rows].join('\n');
}
