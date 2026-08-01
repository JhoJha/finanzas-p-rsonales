<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import TransactionHistory from '$lib/components/TransactionHistory.svelte';
	import { Search, Wallet, Target, HandCoins } from '@lucide/svelte';

	let query = $state('');
	let normalizedQuery = $derived(query.trim().toLowerCase());
	let matchingTransactions = $derived(financeStore.transactions.filter((transaction) => {
		if (!normalizedQuery) return false;
		const category = financeStore.categories.find((item) => item.id === transaction.categoryId)?.name || '';
		const account = financeStore.accounts.find((item) => item.id === transaction.accountId)?.name || '';
		return [transaction.note, category, account, transaction.amount.toString()].some((value) => value?.toLowerCase().includes(normalizedQuery));
	}).reverse());
	let matchingAccounts = $derived(financeStore.accounts.filter((account) => normalizedQuery && account.name.toLowerCase().includes(normalizedQuery)));
	let matchingGoals = $derived(financeStore.goals.filter((goal) => normalizedQuery && goal.name.toLowerCase().includes(normalizedQuery)));
	let matchingDebts = $derived(financeStore.debts.filter((debt) => normalizedQuery && debt.contactName.toLowerCase().includes(normalizedQuery)));
</script>

<div class="animate-fade-in-up space-y-5">
	<div class="flex items-center gap-2"><Search size={26} style="color: var(--color-primary);" /><h1 class="text-2xl font-bold" style="color: var(--color-text);">Búsqueda global</h1></div>
	<div class="relative"><Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--color-text-secondary);" /><input type="search" bind:value={query} placeholder="Movimiento, cuenta, meta o deuda…" class="w-full rounded-xl py-3 pl-10 pr-3 outline-none" style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);" /></div>
	{#if !normalizedQuery}
		<div class="rounded-2xl p-8 text-center text-sm" style="background-color: var(--color-surface); color: var(--color-text-secondary);">Busca por nota, categoría, monto, cuenta, meta o persona.</div>
	{:else}
		{#if matchingAccounts.length || matchingGoals.length || matchingDebts.length}
			<div class="space-y-2 rounded-2xl p-4" style="background-color: var(--color-surface);">
				{#each matchingAccounts as account}<a href="/ajustes/cuentas" class="flex items-center gap-3 rounded-xl p-2 hover:bg-black/5"><Wallet size={18} style="color: var(--color-primary);" /><span style="color: var(--color-text);">Cuenta: {account.name}</span></a>{/each}
				{#each matchingGoals as goal}<a href="/ahorro" class="flex items-center gap-3 rounded-xl p-2 hover:bg-black/5"><Target size={18} style="color: var(--color-success);" /><span style="color: var(--color-text);">Meta: {goal.name}</span></a>{/each}
				{#each matchingDebts as debt}<a href="/deudas" class="flex items-center gap-3 rounded-xl p-2 hover:bg-black/5"><HandCoins size={18} style="color: var(--color-danger);" /><span style="color: var(--color-text);">Deuda: {debt.contactName}</span></a>{/each}
			</div>
		{/if}
		{#if matchingTransactions.length}<div class="rounded-2xl p-4" style="background-color: var(--color-surface);"><h2 class="mb-3 font-semibold" style="color: var(--color-text);">Movimientos ({matchingTransactions.length})</h2><TransactionHistory transactions={matchingTransactions} /></div>{/if}
		{#if !matchingTransactions.length && !matchingAccounts.length && !matchingGoals.length && !matchingDebts.length}<div class="rounded-2xl p-8 text-center text-sm" style="background-color: var(--color-surface); color: var(--color-text-secondary);">No encontramos resultados para “{query}”.</div>{/if}
	{/if}
</div>
