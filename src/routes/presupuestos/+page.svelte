<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { Target, Plus, Trash2, TrendingDown } from '@lucide/svelte';

	let categoryId = $state(financeStore.categories.filter((category) => category.type === 'expense' && !category.id.startsWith('__'))[0]?.id || '');
	let amount = $state('');
	let period = $state<'weekly' | 'monthly'>('monthly');
	let alertThreshold = $state(80);

	function addBudget() {
		const parsedAmount = Number(amount);
		if (!categoryId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
			toastStore.add('Indica una categoría y un límite válido.', 'error');
			return;
		}
		if (financeStore.budgets.some((budget) => budget.categoryId === categoryId && budget.period === period)) {
			toastStore.add('Ya existe un presupuesto para esta categoría y período.', 'error');
			return;
		}
		financeStore.addBudget({ id: crypto.randomUUID(), categoryId, amount: parsedAmount, period, alertThreshold });
		amount = '';
		toastStore.add('Presupuesto creado.', 'success');
	}

	function deleteBudget(id: string) {
		financeStore.deleteBudget(id);
		toastStore.add('Presupuesto eliminado.', 'info');
	}
</script>

<div class="animate-fade-in-up space-y-5">
	<div class="flex items-center gap-2">
		<Target size={26} style="color: var(--color-primary);" />
		<h1 class="text-2xl font-bold" style="color: var(--color-text);">Presupuestos</h1>
	</div>
	<p class="text-sm" style="color: var(--color-text-secondary);">Define límites semanales o mensuales y recibe alertas antes de excederlos.</p>

	<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
		<h2 class="mb-4 text-sm font-semibold" style="color: var(--color-text);">Nuevo presupuesto</h2>
		<div class="space-y-3">
			<div>
				<label for="budget-category" class="block text-xs font-medium" style="color: var(--color-text-secondary);">Categoría</label>
				<select id="budget-category" bind:value={categoryId} class="mt-1 w-full rounded-xl p-3 text-sm outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);">
					{#each financeStore.categories.filter((category) => category.type === 'expense' && !category.id.startsWith('__')) as category}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="budget-period" class="block text-xs font-medium" style="color: var(--color-text-secondary);">Período</label>
					<select id="budget-period" bind:value={period} class="mt-1 w-full rounded-xl p-3 text-sm outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);">
						<option value="weekly">Semanal</option>
						<option value="monthly">Mensual</option>
					</select>
				</div>
				<div>
					<label for="budget-alert" class="block text-xs font-medium" style="color: var(--color-text-secondary);">Alertar al</label>
					<select id="budget-alert" bind:value={alertThreshold} class="mt-1 w-full rounded-xl p-3 text-sm outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);">
						<option value={50}>50%</option><option value={80}>80%</option><option value={90}>90%</option>
					</select>
				</div>
			</div>
			<div>
				<label for="budget-amount" class="block text-xs font-medium" style="color: var(--color-text-secondary);">Límite en moneda base</label>
				<input id="budget-amount" type="number" min="0" step="0.01" bind:value={amount} placeholder="0.00" class="mt-1 w-full rounded-xl p-3 text-lg font-bold outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" />
			</div>
			<button onclick={addBudget} class="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-white" style="background-color: var(--color-primary);"><Plus size={18} /> Añadir presupuesto</button>
		</div>
	</div>

	<div class="space-y-4">
		{#each financeStore.budgets as budget}
			{@const progress = financeStore.getBudgetProgress(budget.id)}
			{@const category = financeStore.categories.find((item) => item.id === budget.categoryId)}
			{#if progress && category}
				<div class="rounded-2xl p-4 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
					<div class="mb-3 flex items-center justify-between gap-3">
						<div><p class="font-semibold" style="color: var(--color-text);">{category.name}</p><p class="text-xs" style="color: var(--color-text-secondary);">{progress.period === 'weekly' ? 'Esta semana' : 'Este mes'} · alerta al {progress.alertThreshold}%</p></div>
						<button onclick={() => deleteBudget(budget.id)} aria-label="Eliminar presupuesto" class="rounded-full p-2 text-red-500 hover:bg-red-500/10"><Trash2 size={16} /></button>
					</div>
					<div class="mb-1 flex justify-between text-xs font-medium"><span style="color: var(--color-text-secondary);">{financeStore.formatCurrency(progress.spent)} gastado</span><span style="color: var(--color-text);">{financeStore.formatCurrency(progress.budget)}</span></div>
					<div class="h-2 w-full overflow-hidden rounded-full" style="background-color: var(--color-bg);"><div class="h-full rounded-full" style="width: {Math.min(progress.percent, 100)}%; background-color: {progress.percent >= 100 ? 'var(--color-danger)' : progress.percent >= progress.alertThreshold ? '#f59e0b' : 'var(--color-primary)'};"></div></div>
					<div class="mt-3 grid grid-cols-2 gap-2 text-xs">
						<div class="rounded-lg p-2" style="background-color: var(--color-bg);"><span style="color: var(--color-text-secondary);">Disponible</span><p class="mt-0.5 font-bold" style="color: {progress.available < 0 ? 'var(--color-danger)' : 'var(--color-text)'};">{financeStore.formatCurrency(progress.available)}</p></div>
						<div class="rounded-lg p-2" style="background-color: var(--color-bg);"><span style="color: var(--color-text-secondary);">Por día ({progress.daysLeft}d)</span><p class="mt-0.5 font-bold" style="color: var(--color-text);">{financeStore.formatCurrency(progress.dailyAvailable)}</p></div>
					</div>
					<p class="mt-3 flex items-center gap-1 text-xs" style="color: var(--color-text-secondary);"><TrendingDown size={13} /> Período anterior: {financeStore.formatCurrency(progress.previousSpent)}</p>
					{#if progress.percent >= 100}<p class="mt-2 text-xs font-semibold" style="color: var(--color-danger);">Presupuesto superado.</p>{:else if progress.percent >= progress.alertThreshold}<p class="mt-2 text-xs font-semibold" style="color: #d97706;">Atención: estás cerca del límite.</p>{/if}
				</div>
			{/if}
		{/each}
		{#if financeStore.budgets.length === 0}<div class="rounded-2xl p-8 text-center text-sm" style="background-color: var(--color-surface); color: var(--color-text-secondary);">No has definido presupuestos todavía.</div>{/if}
	</div>
</div>
