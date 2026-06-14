import { financeStore } from '$lib/store.svelte';

export function exportTransactionsToCSV() {
    const transactions = financeStore.transactions;
    const categories = financeStore.categories;
    const accounts = financeStore.accounts;

    const headers = ['Fecha', 'Cuenta', 'Categoría', 'Tipo', 'Monto', 'Nota'];
    const rows = transactions.map(t => {
        const d = new Date(t.timestamp || t.date);
        const dateStr = d.toLocaleDateString('es-PE') + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        
        const account = accounts.find(a => a.id === t.accountId)?.name || 'Desconocida';
        const category = categories.find(c => c.id === t.categoryId)?.name || 'Sin Categoría';
        const type = t.type === 'income' ? 'Ingreso' : t.type === 'expense' ? 'Gasto' : 'Transferencia';
        
        const note = `"${(t.note || '').replace(/"/g, '""')}"`;
        
        return [dateStr, `"${account}"`, `"${category}"`, type, t.amount.toString(), note].join(',');
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n'); // Add BOM for Excel UTF-8 support
    return csvContent;
}
