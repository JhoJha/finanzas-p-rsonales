<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { MAX_IMPORT_FILE_BYTES, normalizeMerchant, parseBankDate, parseImportCsvWithDiagnostics } from '$lib/utils/import';
	import type { ImportRow } from '$lib/schema';
	import { ArrowLeft, FileUp, Save, Trash2 } from '@lucide/svelte';

	let input = $state<HTMLInputElement>();
	let rows = $state<ImportRow[]>([]);
	let selectedAccountId = $state('');
	let fileName = $state('');
	let isImporting = $state(false);
	let expenseCategories = $derived(financeStore.categories.filter((category) => category.type === 'expense' && !category.id.startsWith('__')));
	let incomeCategories = $derived(financeStore.categories.filter((category) => category.type === 'income' && !category.id.startsWith('__')));
	let selectedRows = $derived(rows.filter((row) => row.selected && !row.duplicate));

	function duplicate(row: ImportRow): boolean {
		const date = parseBankDate(row.date)?.toISOString().slice(0, 10) ?? row.date.slice(0, 10);
		return financeStore.transactions.some((transaction) =>
			transaction.date.slice(0, 10) === date &&
			transaction.amount === Math.abs(row.amount) &&
			normalizeMerchant(transaction.note || '') === row.merchant
		);
	}

	async function readFile(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > MAX_IMPORT_FILE_BYTES) { toastStore.add('El CSV supera el límite de 5 MB.', 'error'); return; }
		if (!/\.(csv|txt)$/i.test(file.name)) { toastStore.add('Por ahora importa CSV (puedes exportarlo desde Excel).', 'info'); return; }
		try {
			const parsed = parseImportCsvWithDiagnostics(await file.text(), financeStore.categories, financeStore.settings.importRules);
			rows = parsed.rows.map((row) => ({ ...row, duplicate: duplicate(row), selected: !duplicate(row) }));
			fileName = file.name;
			selectedAccountId = financeStore.accounts[0]?.id ?? '';
			toastStore.add(`${rows.length} movimientos listos para revisar.${parsed.skipped ? ` ${parsed.skipped} fila(s) se omitieron por importe o descripción inválidos.` : ''}`, parsed.skipped ? 'warning' : 'success');
		} catch (error) { toastStore.add(error instanceof Error ? error.message : 'No se pudo leer el CSV.', 'error'); }
	}

	function rememberRule(row: ImportRow) {
		if (!row.categoryId) { toastStore.add('Selecciona primero una categoría.', 'info'); return; }
		const merchant = row.merchant;
		const rules = financeStore.settings.importRules.filter((rule) => normalizeMerchant(rule.merchant) !== merchant);
		financeStore.updateSettings({ importRules: [...rules, { id: crypto.randomUUID(), merchant, categoryId: row.categoryId }] });
		toastStore.add(`Regla guardada para ${merchant}.`, 'success');
	}

	function importRows() {
		if (!selectedAccountId || selectedRows.length === 0) return;
		isImporting = true;
		try {
			const compatible = selectedRows.filter((row) => parseBankDate(row.date));
			for (const row of compatible) row.date = parseBankDate(row.date)!.toISOString();
			const result = financeStore.importTransactions(compatible, selectedAccountId);
			toastStore.add(`Importados ${result.imported} movimientos${result.skipped ? `; omitidos ${result.skipped} duplicados o inválidos` : ''}.`, 'success');
			rows = [];
			fileName = '';
		} catch (error) { toastStore.add(error instanceof Error ? error.message : 'No se pudieron guardar los movimientos.', 'error'); }
		finally { isImporting = false; }
	}
</script>

<div class="animate-fade-in-up space-y-5">
	<div class="flex items-center gap-3"><a href="/ajustes" class="rounded-full p-2" style="color: var(--color-text);"><ArrowLeft size={22} /></a><div><h1 class="text-2xl font-bold" style="color: var(--color-text);">Importar movimientos</h1><p class="text-xs" style="color: var(--color-text-secondary);">CSV de tu banco, con revisión antes de guardar.</p></div></div>

	{#if rows.length === 0}
		<div class="rounded-2xl p-6 text-center shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
			<FileUp class="mx-auto mb-3" size={40} style="color: var(--color-primary);" />
			<p class="font-semibold" style="color: var(--color-text);">Selecciona un estado de cuenta CSV</p>
			<p class="mt-2 text-xs" style="color: var(--color-text-secondary);">Debe tener columnas de fecha, monto y descripción. Máximo 5 MB y 500 filas por importación.</p>
			<input bind:this={input} class="hidden" type="file" accept=".csv,.txt,text/csv" onchange={readFile} />
			<button onclick={() => input?.click()} class="mt-5 rounded-xl px-5 py-3 text-sm font-bold text-white" style="background-color: var(--color-primary);">Elegir CSV</button>
		</div>
	{:else}
		<div class="rounded-2xl p-4 shadow-sm space-y-3" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
			<p class="text-sm font-semibold" style="color: var(--color-text);">{fileName} · {rows.length} filas</p>
			<label for="import-account" class="block text-xs" style="color: var(--color-text-secondary);">Cuenta de destino</label>
			<select id="import-account" bind:value={selectedAccountId} class="w-full rounded-xl p-3 text-sm" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);">{#each financeStore.accounts as account}<option value={account.id}>{account.name} ({account.currency || financeStore.settings.baseCurrency})</option>{/each}</select>
			<p class="text-xs" style="color: var(--color-text-secondary);">Los movimientos detectados como duplicados no se importarán. Revisa y desmarca lo que no quieras guardar.</p>
		</div>
		<div class="space-y-2">
			{#each rows as row (row.id)}
				<div class="rounded-xl p-3 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border); opacity: {row.duplicate ? 0.65 : 1};">
					<div class="flex items-start gap-2"><input type="checkbox" bind:checked={row.selected} disabled={row.duplicate} class="mt-1" /><div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold" style="color: var(--color-text);">{row.description}</p><p class="text-xs" style="color: var(--color-text-secondary);">{row.date} · {financeStore.formatCurrency(Math.abs(row.amount), financeStore.accounts.find((a) => a.id === selectedAccountId)?.currency)}</p></div>{#if row.duplicate}<span class="text-xs text-amber-600">Duplicado</span>{/if}</div>
					<div class="mt-2 flex gap-2"><select bind:value={row.categoryId} class="min-w-0 flex-1 rounded-lg p-2 text-xs" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"><option value={undefined}>Sin categoría</option>{#each row.amount < 0 ? expenseCategories : incomeCategories as category}<option value={category.id}>{category.name}</option>{/each}</select><button onclick={() => rememberRule(row)} title="Recordar categoría para este comercio" class="rounded-lg px-3 text-xs font-semibold" style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary);">Regla</button></div>
				</div>
			{/each}
		</div>
		<div class="sticky bottom-2 rounded-2xl p-3 shadow-lg" style="background-color: var(--color-surface); border: 1px solid var(--color-border);"><button onclick={importRows} disabled={isImporting || selectedRows.length === 0} class="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-white disabled:opacity-50" style="background-color: var(--color-primary);"><Save size={18} /> {isImporting ? 'Importando…' : `Importar ${selectedRows.length} movimientos`}</button></div>
	{/if}

	{#if financeStore.settings.importRules.length > 0}<div class="rounded-2xl p-4" style="background-color: var(--color-surface); border: 1px solid var(--color-border);"><h2 class="mb-2 text-sm font-semibold" style="color: var(--color-text);">Reglas guardadas</h2>{#each financeStore.settings.importRules as rule}<div class="flex justify-between py-1 text-xs"><span style="color: var(--color-text-secondary);">{rule.merchant}</span><button onclick={() => financeStore.updateSettings({ importRules: financeStore.settings.importRules.filter((item) => item.id !== rule.id) })} aria-label="Eliminar regla" class="text-red-500"><Trash2 size={14} /></button></div>{/each}</div>{/if}
</div>
