<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { Trash2, DollarSign, ArrowUp, ArrowDown, Pencil, X, Save } from '@lucide/svelte';
	import type { Transaction } from '$lib/schema';
	import { toastStore } from '$lib/toast.svelte';
	import { vibrate } from '$lib/utils/haptics';

	let { transactions = [] as Transaction[] } = $props();

	let editingId = $state<string | null>(null);
	let editAmount = $state<number>(0);
	let editNote = $state<string>('');
	let editCategoryId = $state<string>('');
	let editType = $state<'income'|'expense'>('expense');

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
			vibrate([10, 30, 10]);
			toastStore.add('Transacción eliminada', 'error');
		}
	}

	function startEdit(t: Transaction) {
		editingId = t.id;
		editAmount = t.amount;
		editNote = t.note || '';
		editCategoryId = t.categoryId;
		editType = t.type;
	}

	function saveEdit() {
		if(editingId) {
			financeStore.updateTransaction(editingId, {
				amount: editAmount,
				note: editNote,
				categoryId: editCategoryId
			});
			vibrate(15);
			toastStore.add('Cambios guardados', 'success');
			editingId = null;
		}
	}

	function cancelEdit() {
		editingId = null;
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
	<div class="space-y-2">
		{#each transactions as t (t.id)}
			{#if editingId === t.id}
				<!-- Formulario de Edición en Línea -->
				<div class="animate-fade-in-up flex flex-col gap-3 rounded-xl p-4 shadow-md" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
					<div class="flex justify-between items-center mb-1">
						<span class="text-xs font-bold uppercase tracking-wider" style="color: var(--color-text-secondary);">Editar Transacción</span>
						<button onclick={cancelEdit} class="text-gray-400 hover:text-gray-600">
							<X size={18} />
						</button>
					</div>

					<div class="flex gap-2">
						<div class="relative flex-1">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">S/</span>
							<input
								type="number"
								step="0.01"
								bind:value={editAmount}
								class="w-full rounded-xl py-2 pl-8 pr-3 text-sm outline-none"
								style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
							/>
						</div>
						<select
							bind:value={editCategoryId}
							class="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
							style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
						>
							{#each financeStore.categories.filter(c => c.type === editType || editType === 'transfer') as cat}
								<option value={cat.id}>{cat.name}</option>
							{/each}
						</select>
					</div>

					<input
						type="text"
						bind:value={editNote}
						placeholder="Nota (opcional)"
						class="w-full rounded-xl px-3 py-2 text-sm outline-none"
						style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
					/>

					<button
						onclick={saveEdit}
						class="mt-1 flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-white transition-all active:scale-95"
						style="background-color: var(--color-primary);"
					>
						<Save size={16} /> Guardar Cambios
					</button>
				</div>
			{:else}
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
						
						<!-- Acciones -->
						<div class="flex flex-col gap-1 ml-1">
							<button
								onclick={() => startEdit(t)}
								class="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-gray-200 hover:text-gray-800 active:scale-90"
								style="color: var(--color-text-secondary);"
								aria-label="Editar"
							>
								<Pencil size={13} />
							</button>
							<button
								onclick={() => confirmDelete(t.id)}
								class="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-red-100 hover:text-red-600 active:scale-90"
								style="color: var(--color-text-secondary);"
								aria-label="Eliminar"
							>
								<Trash2 size={13} />
							</button>
						</div>
					</div>
				</div>
			{/if}
		{/each}
	</div>
{/if}
