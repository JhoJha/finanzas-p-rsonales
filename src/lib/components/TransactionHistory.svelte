<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { Trash2, DollarSign, ArrowUp, ArrowDown } from '@lucide/svelte';
	import type { Transaction } from '$lib/schema';

	let { transactions = [] as Transaction[] } = $props();

	function getCategoryColor(categoryId: string): string {
		const cat = financeStore.categories.find((c) => c.id === categoryId);
		return cat?.color || 'bg-gray-500';
	}

	function getCategoryName(categoryId: string): string {
		const cat = financeStore.categories.find((c) => c.id === categoryId);
		return cat?.name || 'Sin categoría';
	}

	function confirmDelete(id: string) {
		if (confirm('¿Eliminar esta transacción?')) {
			financeStore.deleteTransaction(id);
		}
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		const hoy = new Date();
		const ayer = new Date(hoy);
		ayer.setDate(ayer.getDate() - 1);

		if (d.toDateString() === hoy.toDateString()) return 'Hoy';
		if (d.toDateString() === ayer.toDateString()) return 'Ayer';

		return d.toLocaleDateString('es-PE', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

{#if transactions.length === 0}
	<div class="flex flex-col items-center justify-center py-12 text-gray-400">
		<DollarSign size={48} class="mb-3 opacity-30" />
		<p class="text-sm font-medium">No hay transacciones</p>
		<p class="mt-1 text-xs">Registra tu primer gasto o ingreso</p>
	</div>
{:else}
	<div class="space-y-1">
		{#each transactions as t (t.id)}
			<div
				class="animate-fade-in-up flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:opacity-80"
				style="background-color: var(--color-bg);"
			>
				<div
					class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white"
					class:bg-green-500={t.type === 'income'}
					class:bg-red-500={t.type === 'expense'}
				>
					{#if t.type === 'income'}
						<ArrowUp size={18} />
					{:else}
						<ArrowDown size={18} />
					{/if}
				</div>

				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium" style="color: var(--color-text);">
						{t.note || getCategoryName(t.categoryId)}
					</p>
					<p class="text-xs" style="color: var(--color-text-secondary);">
						{getCategoryName(t.categoryId)} · {formatDate(t.date)}
					</p>
				</div>

				<div class="flex items-center gap-2">
					<span
						class="text-sm font-bold"
						style="color: {t.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)'};"
					>
						{t.type === 'income' ? '+' : '-'}S/ {t.amount.toFixed(2)}
					</span>
					<button
						onclick={() => confirmDelete(t.id)}
						class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-red-100 hover:text-red-600 active:scale-90"
						style="color: var(--color-text-secondary);"
					>
						<Trash2 size={15} />
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}
