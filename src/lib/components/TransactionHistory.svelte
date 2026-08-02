<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { Trash2, DollarSign, ArrowUp, ArrowDown, Pencil, X, Save, Calendar } from '@lucide/svelte';
	import type { Transaction } from '$lib/schema';
	import { toastStore } from '$lib/toast.svelte';
	import { vibrate } from '$lib/utils/haptics';
	import { categoryDisplayName, formatCalendarDate } from '$lib/i18n';
	import { dateTimeFromDateOnly, toDateOnlyInTimeZone, todayInTimeZone } from '$lib/utils/date';

	let { transactions = [] as Transaction[] } = $props();

	let editingId = $state<string | null>(null);
	let editAmount = $state<number>(0);
	let editNote = $state<string>('');
	let editCategoryId = $state<string>('');
	let editType = $state<'income'|'expense'|'transfer'>('expense');
	let editDate = $state<string>(''); // YYYY-MM-DD
	let editAccountId = $state<string>('');
	let editToAccountId = $state<string>('');
	let editAccountCurrency = $derived(financeStore.accounts.find((account) => account.id === editAccountId)?.currency || financeStore.settings.baseCurrency);
	let canUndoDelete = $state(false);
	let undoTimer: ReturnType<typeof setTimeout> | undefined;

	function getCategoryColor(categoryId: string): string {
		const cat = financeStore.categories.find((c) => c.id === categoryId);
		return cat?.color || 'bg-gray-500';
	}

	function getCategoryName(categoryId: string): string {
		const cat = financeStore.categories.find((c) => c.id === categoryId);
		return categoryDisplayName(cat, financeStore.settings.locale);
	}

	function getTransactionCurrency(transaction: Transaction): string | undefined {
		return financeStore.accounts.find(account => account.id === transaction.accountId)?.currency;
	}

	function confirmDelete(id: string) {
		if (confirm('¿Eliminar esta transacción?')) {
			if (!financeStore.deleteTransaction(id)) return;
			canUndoDelete = true;
			if (undoTimer) clearTimeout(undoTimer);
			undoTimer = setTimeout(() => (canUndoDelete = false), 7000);
			vibrate([10, 30, 10]);
			toastStore.add('Transacción eliminada', 'error');
		}
	}

	function undoDelete() {
		if (!financeStore.restoreLastDeletedTransaction()) return;
		if (undoTimer) clearTimeout(undoTimer);
		canUndoDelete = false;
		vibrate(15);
		toastStore.add('Transacción restaurada.', 'success');
	}

	function startEdit(t: Transaction) {
		editingId = t.id;
		editAmount = t.amount;
		editNote = t.note || '';
		editCategoryId = t.categoryId;
		editType = t.type as 'income' | 'expense' | 'transfer';
		editAccountId = t.accountId;
		editToAccountId = t.toAccountId || '';
		// Convertir ISO a YYYY-MM-DD para el input date
		editDate = toDateOnlyInTimeZone(t.date, financeStore.settings.timeZone);
	}

	function saveEdit() {
		if (editingId) {
			const updated = financeStore.updateTransaction(editingId, {
				amount: editAmount,
				note: editNote,
				categoryId: editCategoryId,
				accountId: editAccountId,
				toAccountId: editType === 'transfer' ? editToAccountId : undefined,
				date: dateTimeFromDateOnly(editDate, financeStore.settings.timeZone)
			});
			if (!updated) return;
			vibrate(15);
			toastStore.add('Cambios guardados', 'success');
			editingId = null;
		}
	}

	function cancelEdit() {
		editingId = null;
	}

	function formatDate(dateStr: string): string {
		return formatCalendarDate(toDateOnlyInTimeZone(dateStr, financeStore.settings.timeZone), financeStore.settings.locale, { day: 'numeric', month: 'long', year: 'numeric' });
	}

	let groupedTransactions = $derived.by(() => {
		const groups: { dateStr: string, txs: Transaction[] }[] = [];
		let lastDate = '';
		for (const t of transactions) {
			const dStr = formatDate(t.date);
			if (dStr !== lastDate) {
				groups.push({ dateStr: dStr, txs: [t] });
				lastDate = dStr;
			} else {
				groups[groups.length - 1].txs.push(t);
			}
		}
		return groups;
	});
</script>

{#if transactions.length === 0}
	<div class="flex flex-col items-center justify-center py-12 text-gray-400">
		<DollarSign size={48} class="mb-3 opacity-30" />
		<p class="text-sm font-medium">No hay transacciones</p>
		<p class="mt-1 text-xs">Registra tu primer gasto o ingreso</p>
	</div>
{:else}
	<div class="space-y-6">
		{#if canUndoDelete}
			<div class="sticky top-2 z-40 flex items-center justify-between gap-3 rounded-xl p-3 shadow-lg" style="background-color: var(--color-primary); color: white;">
				<span class="text-sm font-medium">Movimiento eliminado</span>
				<button onclick={undoDelete} class="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-bold hover:bg-white/30">Deshacer</button>
			</div>
		{/if}
		{#each groupedTransactions as group}
			<div class="relative">
				<div class="sticky top-0 z-30 mb-3 flex items-center justify-between rounded-xl px-4 py-2 shadow-sm backdrop-blur-md transition-all" style="background-color: color-mix(in srgb, var(--color-surface) 80%, transparent); border: 1px solid var(--color-border);">
					<span class="text-xs font-extrabold uppercase tracking-widest" style="color: var(--color-text);">{group.dateStr}</span>
				</div>
				<div class="space-y-2">
				{#each group.txs as t (t.id)}
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
							<span class="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">{editAccountCurrency}</span>
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
						{#each financeStore.categories.filter(c => !c.id.startsWith('__') && (c.type === editType || editType === 'transfer')) as cat}
							<option value={cat.id}>{categoryDisplayName(cat, financeStore.settings.locale)}</option>
						{/each}
					</select>
					</div>

					<select
						bind:value={editAccountId}
						class="w-full rounded-xl px-3 py-2 text-sm outline-none"
						style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
					>
						{#each financeStore.accounts as account}
							<option value={account.id}>Cuenta: {account.name}</option>
						{/each}
					</select>

					{#if editType === 'transfer'}
						<select
							bind:value={editToAccountId}
							class="w-full rounded-xl px-3 py-2 text-sm outline-none"
							style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
						>
							{#each financeStore.accounts.filter((account) => account.id !== editAccountId) as account}
								<option value={account.id}>Hacia: {account.name}</option>
							{/each}
						</select>
					{/if}

					<input
						type="text"
						bind:value={editNote}
						placeholder="Nota (opcional)"
						class="w-full rounded-xl px-3 py-2 text-sm outline-none"
						style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
					/>

					<!-- Fecha -->
					<div class="flex items-center gap-2">
						<Calendar size={14} style="color: var(--color-text-secondary); flex-shrink: 0;" />
						<input
							type="date"
							bind:value={editDate}
							max={todayInTimeZone(financeStore.settings.timeZone)}
							class="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
							style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
						/>
					</div>

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
							{t.type === 'income' ? '+' : '-'}{financeStore.formatCurrency(t.amount, getTransactionCurrency(t))}
						</span>
						
						<!-- Acciones -->
						<div class="flex flex-col gap-1 ml-1">
							{#if !t.debtId && !t.goalId}
							<button
								onclick={() => startEdit(t)}
								class="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-gray-200 hover:text-gray-800 active:scale-90"
								style="color: var(--color-text-secondary);"
								aria-label="Editar"
							>
								<Pencil size={13} />
							</button>
							{/if}
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
			</div>
		{/each}
	</div>
{/if}
