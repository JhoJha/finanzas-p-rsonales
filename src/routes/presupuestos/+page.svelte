<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { Target, Plus, Trash2 } from '@lucide/svelte';

	let categoryId = $state(financeStore.categories.filter(c => c.type === 'expense')[0]?.id || '');
	let amount = $state('');

	function addBudget() {
		if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
			toastStore.add('Monto inválido', 'error');
			return;
		}

		if (financeStore.budgets.some(b => b.categoryId === categoryId)) {
			toastStore.add('Ya existe un presupuesto para esta categoría', 'error');
			return;
		}

		financeStore.addBudget({
			id: crypto.randomUUID(),
			categoryId,
			amount: parseFloat(amount),
			period: 'monthly'
		});

		toastStore.add('Presupuesto creado', 'success');
		amount = '';
	}

	function deleteBudget(id: string) {
		financeStore.deleteBudget(id);
		toastStore.add('Presupuesto eliminado', 'info');
	}
</script>

<div class="animate-fade-in-up space-y-5">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold" style="color: var(--color-text);">Presupuestos</h1>
	</div>

	<p class="text-sm" style="color: var(--color-text-secondary);">
		Define límites de gasto mensual para tus categorías y mantén el control.
	</p>

	<!-- Formulario -->
	<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface);">
		<h2 class="mb-4 text-sm font-semibold" style="color: var(--color-text);">Nuevo Presupuesto Mensual</h2>
		
		<div class="space-y-3">
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-13">Categoría</label>
				<select id="a11y-13"
					bind:value={categoryId}
					class="mt-1 w-full rounded-xl p-3 text-sm outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				>
					{#each financeStore.categories.filter(c => c.type === 'expense') as cat}
						<option value={cat.id}>{cat.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-14">Límite (S/)</label>
				<input id="a11y-14"
					type="number"
					bind:value={amount}
					placeholder="0.00"
					class="mt-1 w-full rounded-xl p-3 text-lg font-bold outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
			</div>

			<button
				onclick={addBudget}
				class="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-white shadow-md transition-all active:scale-95"
				style="background-color: var(--color-primary);"
			>
				<Plus size={18} />
				<span>Añadir</span>
			</button>
		</div>
	</div>

	<!-- Lista de Presupuestos -->
	<div class="space-y-4">
		{#each financeStore.budgets as budget}
			{@const progress = financeStore.getBudgetProgress(budget.categoryId)}
			{@const category = financeStore.categories.find(c => c.id === budget.categoryId)}
			
			{#if progress && category}
				<div class="rounded-2xl p-4 shadow-sm relative overflow-hidden" style="background-color: var(--color-surface);">
					<div class="mb-2 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-xl">{category.icon}</span>
							<span class="font-medium" style="color: var(--color-text);">{category.name}</span>
						</div>
						<button 
							onclick={() => deleteBudget(budget.id)}
							class="p-1 rounded-full text-red-500 hover:bg-red-500/10 transition-colors"
						>
							<Trash2 size={16} />
						</button>
					</div>

					<div class="mb-1 flex justify-between text-xs font-medium">
						<span style="color: {progress.percent > 100 ? 'var(--color-danger)' : 'var(--color-text-secondary)'};">
							S/ {progress.spent.toFixed(2)} gastado
						</span>
						<span style="color: var(--color-text);">S/ {budget.amount.toFixed(2)}</span>
					</div>

					<!-- Barra de progreso -->
					<div class="h-2 w-full overflow-hidden rounded-full" style="background-color: var(--color-bg);">
						<div
							class="h-full rounded-full transition-all duration-500"
							style="width: {Math.min(progress.percent, 100)}%; background-color: {progress.percent >= 100 ? 'var(--color-danger)' : progress.percent >= 80 ? 'var(--color-warning, #f59e0b)' : 'var(--color-primary)'};"
						></div>
					</div>
					
					{#if progress.percent >= 100}
						<p class="mt-2 text-xs font-semibold" style="color: var(--color-danger);">¡Presupuesto superado!</p>
					{:else if progress.percent >= 80}
						<p class="mt-2 text-xs font-semibold" style="color: #f59e0b;">Cerca del límite ({progress.percent}%)</p>
					{/if}
				</div>
			{/if}
		{/each}

		{#if financeStore.budgets.length === 0}
			<div class="rounded-2xl p-8 text-center text-sm" style="background-color: var(--color-surface); color: var(--color-text-secondary);">
				No has definido ningún presupuesto aún.
			</div>
		{/if}
	</div>
</div>
