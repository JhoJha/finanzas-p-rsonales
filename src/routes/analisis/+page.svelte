<script lang="ts">
	import { financeStore } from '$lib/store.svelte';

	let expenses = $derived(financeStore.transactions.filter(t => t.type === 'expense'));
	
	let expensesByCategory = $derived.by(() => {
		const totals = {} as Record<string, number>;
		expenses.forEach(t => {
			totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amount;
		});
		
		const totalExpenses = financeStore.summary.expenses || 1;
		
		return Object.entries(totals)
			.map(([id, amount]) => {
				const cat = financeStore.categories.find(c => c.id === id);
				return {
					id,
					name: cat?.name || 'Otro',
					amount,
					color: cat?.color || 'bg-gray-500',
					percent: Math.round((amount / totalExpenses) * 100)
				};
			})
			.sort((a, b) => b.amount - a.amount);
	});

	let maxCategory = $derived(expensesByCategory[0]);

	// Simulando la comparación semanal
	let smartAlert = $derived.by(() => {
		if (expenses.length === 0) return null;
		if (maxCategory) {
			return `Tu categoría con mayor gasto es ${maxCategory.name} (${maxCategory.percent}% del total). Considera revisar estos gastos.`;
		}
		return null;
	});
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-gray-900">Análisis y Alertas</h1>

	{#if smartAlert}
		<div class="rounded-2xl border-l-4 border-yellow-500 bg-yellow-50 p-4 shadow-sm">
			<h3 class="font-semibold text-yellow-800">💡 Análisis Inteligente</h3>
			<p class="mt-1 text-sm text-yellow-700">{smartAlert}</p>
		</div>
	{/if}

	<div class="rounded-2xl bg-white p-5 shadow-sm">
		<h2 class="mb-4 text-lg font-semibold text-gray-800">Gasto por Categorías</h2>
		
		{#if expensesByCategory.length === 0}
			<p class="text-sm text-gray-500 text-center py-4">No hay datos suficientes.</p>
		{:else}
			<div class="space-y-4">
				{#each expensesByCategory as item}
					<div>
						<div class="mb-1 flex justify-between text-sm">
							<span class="font-medium text-gray-700">{item.name}</span>
							<span class="font-semibold text-gray-900">S/ {item.amount.toFixed(2)}</span>
						</div>
						<div class="h-2 w-full rounded-full bg-gray-100">
							<div class="h-full rounded-full {item.color} transition-all" style="width: {item.percent}%"></div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>