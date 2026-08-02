<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { categoryDisplayName } from '$lib/i18n';
	import { ArrowLeft, CheckCircle2 } from '@lucide/svelte';

	let selections = $state<Record<string, string>>({});
	let learn = $state<Record<string, boolean>>({});
	let pending = $derived(financeStore.transactions.filter((transaction) => financeStore.categories.find((category) => category.id === transaction.categoryId)?.code === 'uncategorized'));
	let expenseCategories = $derived(financeStore.categories.filter((category) => category.type === 'expense' && category.code !== 'uncategorized' && !category.id.startsWith('__')));

	function resolve(id: string) {
		const transaction = financeStore.transactions.find((item) => item.id === id);
		const categoryId = selections[id];
		if (!transaction || !categoryId) return;
		if (!financeStore.updateTransaction(id, { categoryId })) return;
		if (learn[id]) financeStore.learnClassificationRule(transaction.merchant || transaction.note || '', categoryId, 'expense', financeStore.settings.locale);
	}
</script>

<div class="animate-fade-in-up space-y-5">
	<div class="flex items-center gap-3"><a href="/ajustes" class="rounded-full p-2" style="color: var(--color-text);"><ArrowLeft size={22} /></a><div><h1 class="text-2xl font-bold" style="color: var(--color-text);">Pendientes por clasificar</h1><p class="text-sm" style="color: var(--color-text-secondary);">Corrige los movimientos inciertos y, si quieres, aprende una regla local.</p></div></div>
	{#if pending.length}
		<div class="space-y-3">
			{#each pending as transaction (transaction.id)}
				<div class="rounded-2xl p-4" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
					<div><p class="font-semibold" style="color: var(--color-text);">{transaction.merchant || transaction.note || 'Sin detalle'}</p><p class="text-xs" style="color: var(--color-text-secondary);">{transaction.counterparty ? `${transaction.counterparty} · ` : ''}{transaction.date.slice(0, 10)} · {financeStore.formatCurrency(transaction.amount)}</p></div>
					<select value={selections[transaction.id] || ''} onchange={(event) => selections = { ...selections, [transaction.id]: (event.currentTarget as HTMLSelectElement).value }} class="mt-3 w-full rounded-xl p-3 text-sm" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"><option value="">Elige una categoría</option>{#each expenseCategories as category}<option value={category.id}>{categoryDisplayName(category, financeStore.settings.locale)}</option>{/each}</select>
					<div class="mt-3 flex items-center justify-between gap-3"><label class="flex items-center gap-2 text-xs" style="color: var(--color-text-secondary);"><input type="checkbox" checked={learn[transaction.id] ?? false} onchange={(event) => learn = { ...learn, [transaction.id]: (event.currentTarget as HTMLInputElement).checked }} /> Aprender de {transaction.merchant || 'este detalle'}</label><button onclick={() => resolve(transaction.id)} disabled={!selections[transaction.id]} class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style="background-color: var(--color-primary);"><CheckCircle2 size={16} /> Resolver</button></div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="rounded-2xl p-5 text-sm" style="background-color: var(--color-surface); color: var(--color-text-secondary);">No hay movimientos pendientes. Las categorías inciertas aparecerán aquí.</div>
	{/if}
</div>
