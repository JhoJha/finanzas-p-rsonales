import { financeStore } from '$lib/store.svelte';

function csvCell(value: string | number): string {
	return `"${String(value).replace(/"/g, '""')}"`;
}

/** Exportación apta para Excel que conserva la tasa usada por cada movimiento. */
export function exportTransactionsToCSV() {
	const headers = [
		'Fecha',
		'Cuenta',
		'Moneda cuenta',
		'Categoría',
		'Tipo',
		'Monto original',
		'Tasa histórica',
		'Monto en moneda base',
		'Nota'
	];

	const rows = financeStore.transactions.map((transaction) => {
		const date = new Date(transaction.timestamp || transaction.date);
		const account = financeStore.accounts.find((item) => item.id === transaction.accountId);
		const category = financeStore.categories.find((item) => item.id === transaction.categoryId);
		const type = transaction.type === 'income' ? 'Ingreso' : transaction.type === 'expense' ? 'Gasto' : 'Transferencia';

		return [
			date.toLocaleDateString('es-PE') + ' ' + date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
			account?.name || 'Desconocida',
			account?.currency || financeStore.settings.baseCurrency,
			category?.name || 'Sin categoría',
			type,
			transaction.amount,
			transaction.exchangeRate ?? '',
			financeStore.getTransactionAmountInBase(transaction).toFixed(2),
			transaction.note || ''
		].map(csvCell).join(',');
	});

	return '\uFEFF' + [headers.map(csvCell).join(','), ...rows].join('\n');
}
