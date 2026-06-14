<script lang="ts">
	import { financeStore, type Period } from '$lib/store.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import DateFilter from '$lib/components/DateFilter.svelte';
	import TransactionHistory from '$lib/components/TransactionHistory.svelte';
	import { TrendingUp, AlertTriangle, ArrowUp, ArrowDown, Minus } from '@lucide/svelte';
	import { getColorHex } from '$lib/utils/colors';

	let selectedPeriod = $state<Period>('all');
	let searchQuery = $state('');

	// Datos con filtro de período
	let filteredTransactions = $derived(
		selectedPeriod === 'all'
			? [...financeStore.transactions].reverse()
			: [...financeStore.getTransactionsByPeriod(selectedPeriod)].reverse()
	);

	let showFilters = $state(false);
	let minAmount = $state<number | null>(null);
	let maxAmount = $state<number | null>(null);
	let startDate = $state<string>('');
	let endDate = $state<string>('');

	// Filtro avanzado
	let displayedTransactions = $derived(() => {
		let result = filteredTransactions;

		if (minAmount !== null) result = result.filter(t => t.amount >= minAmount!);
		if (maxAmount !== null) result = result.filter(t => t.amount <= maxAmount!);
		if (startDate) {
			const startTs = new Date(startDate + 'T00:00:00').getTime();
			result = result.filter(t => t.timestamp! >= startTs);
		}
		if (endDate) {
			const endTs = new Date(endDate + 'T23:59:59').getTime();
			result = result.filter(t => t.timestamp! <= endTs);
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			result = result.filter(t => {
				const note = (t.note || '').toLowerCase();
				const catName = (financeStore.categories.find(c => c.id === t.categoryId)?.name || '').toLowerCase();
				const hasTag = t.tags?.some(tag => tag.toLowerCase().includes(q));
				return note.includes(q) || catName.includes(q) || hasTag;
			});
		}

		return result;
	});

	let summary = $derived({
		income: filteredTransactions.filter((t) => t.type === 'income').reduce((a, b) => a + b.amount, 0),
		expenses: filteredTransactions.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amount, 0)
	});

	// Gastos por categoría
	let expensesByCategory = $derived(financeStore.getExpensesByCategory(selectedPeriod));

	let topCategory = $derived(financeStore.getTopCategory(selectedPeriod));

	// Comparación semanal
	let weekComparison = $derived(financeStore.getWeekComparison());

	// Evolución semanal (línea)
	let weeklyEvolution = $derived(financeStore.getWeeklyEvolution());
	let weekLabels = $derived(weeklyEvolution.map((d) => d.label));
	let weekExpenses = $derived(weeklyEvolution.map((d) => d.expenses));
	let weekIncome = $derived(weeklyEvolution.map((d) => d.income));

	// Comparativa mensual (barras)
	let monthlyData = $derived(financeStore.getMonthlyComparison());
	let monthLabels = $derived(monthlyData.map((d) => d.label));
	let monthExpenses = $derived(monthlyData.map((d) => d.expenses));
	let monthIncome = $derived(monthlyData.map((d) => d.income));

	// Charts colors
	let pieColors = $derived(
		expensesByCategory.map((c) => getColorHex(c.color))
	);

	let hasData = $derived(filteredTransactions.length > 0);

	function onPeriodChange(p: Period) {
		selectedPeriod = p;
	}
</script>

<div class="animate-fade-in-up space-y-5">
	<h1 class="text-2xl font-bold" style="color: var(--color-text);">Análisis y Alertas</h1>

	<!-- Filtro de período -->
	<DateFilter selected={selectedPeriod} onChange={onPeriodChange} />

	<!-- Resumen del período -->
	<div class="grid grid-cols-2 gap-3">
		<div class="rounded-2xl p-4 shadow-sm" style="background-color: var(--color-surface);">
			<span class="text-xs font-medium" style="color: var(--color-text-secondary);">Ingresos</span>
			<div class="text-xl font-bold" style="color: var(--color-success);">+ {financeStore.formatCurrency(summary.income)}</div>
		</div>
		<div class="rounded-2xl p-4 shadow-sm" style="background-color: var(--color-surface);">
			<span class="text-xs font-medium" style="color: var(--color-text-secondary);">Gastos</span>
			<div class="text-xl font-bold" style="color: var(--color-danger);">- {financeStore.formatCurrency(summary.expenses)}</div>
		</div>
	</div>

	{#if hasData}
		<!-- Alertas inteligentes -->
		{#if topCategory}
			<div
				class="animate-fade-in-up rounded-2xl border-l-4 p-4 shadow-sm"
				style="background-color: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface)); border-left-color: var(--color-warning);"
			>
				<div class="flex items-start gap-3">
					<AlertTriangle size={20} style="color: var(--color-warning); flex-shrink: 0; margin-top: 2px;" />
					<div>
						<h3 class="text-sm font-semibold" style="color: var(--color-text);">💡 Análisis Inteligente</h3>
						<p class="mt-1 text-xs" style="color: var(--color-text-secondary);">
							<strong>{topCategory.name}</strong> es tu categoría con mayor gasto
							({topCategory.percent}% del total = {financeStore.formatCurrency(topCategory.amount)}).
						</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Comparación semanal -->
		{#if weekComparison.diff !== 0}
			<div
				class="animate-fade-in-up rounded-2xl p-4 shadow-sm"
				style="background-color: var(--color-surface);"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-full"
						style="background-color: {weekComparison.diff > 0 ? 'color-mix(in srgb, var(--color-danger) 20%, transparent)' : 'color-mix(in srgb, var(--color-success) 20%, transparent)'};"
					>
						{#if weekComparison.diff > 0}
							<ArrowUp size={20} style="color: var(--color-danger);" />
						{:else}
							<ArrowDown size={20} style="color: var(--color-success);" />
						{/if}
					</div>
					<div>
						<p class="text-sm font-medium" style="color: var(--color-text);">
							Semana pasada: {financeStore.formatCurrency(weekComparison.previous)}
						</p>
						<p class="text-xs" style="color: var(--color-text-secondary);">
							Esta semana: {financeStore.formatCurrency(weekComparison.current)}
							<span style="color: {weekComparison.diff > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">
								({weekComparison.diff > 0 ? '+' : ''}{weekComparison.diffPercent}%)
							</span>
						</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Gráfico pastel: Gastos por categoría -->
		<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface);">
			<h2 class="mb-3 flex items-center gap-2 text-base font-semibold" style="color: var(--color-text);">
				🥧 Gastos por categoría
			</h2>
			<Chart
				type="doughnut"
				labels={expensesByCategory.map(c => c.name)}
				datasets={[{ label: 'Gastos', data: expensesByCategory.map(c => c.amount), backgroundColor: pieColors }]}
				height={220}
			/>
		</div>

		<!-- Gráfico línea: Evolución semanal -->
		<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface);">
			<h2 class="mb-3 flex items-center gap-2 text-base font-semibold" style="color: var(--color-text);">
				📈 Evolución semanal
			</h2>
			<Chart
				type="line"
				labels={weekLabels}
				datasets={[
					{ label: 'Gastos', data: weekExpenses, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.3 },
					{ label: 'Ingresos', data: weekIncome, borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', fill: true, tension: 0.3 }
				]}
				height={200}
			/>
		</div>

		<!-- Gráfico barras: Comparativa mensual -->
		<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface);">
			<h2 class="mb-3 flex items-center gap-2 text-base font-semibold" style="color: var(--color-text);">
				📊 Comparativa mensual
			</h2>
			<Chart
				type="bar"
				labels={monthLabels}
				datasets={[
					{ label: 'Gastos', data: monthExpenses, backgroundColor: 'rgba(239, 68, 68, 0.7)', borderColor: '#ef4444', borderWidth: 1 },
					{ label: 'Ingresos', data: monthIncome, backgroundColor: 'rgba(34, 197, 94, 0.7)', borderColor: '#22c55e', borderWidth: 1 }
				]}
				height={200}
			/>
		</div>

		<!-- Detalle por categorías (barras horizontales) -->
		<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface);">
			<h2 class="mb-4 flex items-center gap-2 text-base font-semibold" style="color: var(--color-text);">
				📋 Detalle por categoría
			</h2>
			{#if expensesByCategory.length === 0}
				<p class="py-4 text-center text-sm" style="color: var(--color-text-secondary);">Sin gastos en este período</p>
			{:else}
				<div class="space-y-4">
					{#each expensesByCategory as item}
						<div>
							<div class="mb-1 flex justify-between text-sm">
								<span class="font-medium" style="color: var(--color-text);">{item.name}</span>
								<span class="font-bold" style="color: var(--color-text);">{financeStore.formatCurrency(item.amount)}</span>
							</div>
							<div class="h-2.5 w-full rounded-full" style="background-color: var(--color-bg);">
								<div
									class="h-full rounded-full transition-all duration-500"
									class:bg-orange-500={item.color.includes('orange')}
									class:bg-blue-500={item.color.includes('blue')}
									class:bg-green-500={item.color.includes('green')}
									class:bg-purple-500={item.color.includes('purple')}
									class:bg-pink-500={item.color.includes('pink')}
									class:bg-yellow-500={item.color.includes('yellow')}
									class:bg-gray-500={item.color.includes('gray')}
									class:bg-red-500={item.color.includes('red')}
									style="width: {item.percent}%"
								></div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Estado vacío -->
		<div class="flex flex-col items-center justify-center rounded-2xl p-12 shadow-sm" style="background-color: var(--color-surface);">
			<TrendingUp size={56} class="mb-4 opacity-30" style="color: var(--color-text-secondary);" />
			<p class="text-lg font-semibold" style="color: var(--color-text);">Sin datos aún</p>
			<p class="mt-1 text-center text-sm" style="color: var(--color-text-secondary);">
				Registra gastos e ingresos para ver tus análisis
			</p>
		</div>
	{/if}

	<!-- Historial de transacciones filtradas -->
	{#if hasData}
		<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface);">
			<div class="mb-4 flex items-center justify-between gap-3">
				<h2 class="flex items-center gap-2 text-base font-semibold" style="color: var(--color-text);">
					📜 Historial
					<span class="rounded-full px-2 py-0.5 text-xs font-bold text-white" style="background-color: var(--color-primary);">
						{displayedTransactions().length}
					</span>
				</h2>
			</div>
			<div class="relative mb-3">
				<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style="color: var(--color-text-secondary);">🔍</span>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Buscar por nota, #etiqueta o categoría..."
					class="w-full rounded-xl py-2.5 pl-9 pr-10 text-sm outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
				<button
					onclick={() => (showFilters = !showFilters)}
					class="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-xs transition-colors hover:bg-black/5"
					style="color: {showFilters ? 'var(--color-primary)' : 'var(--color-text-secondary)'};"
				>⚙️</button>
			</div>

			{#if showFilters}
				<div class="mb-4 animate-fade-in-up grid grid-cols-2 gap-3 rounded-xl p-3" style="background-color: var(--color-bg); border: 1px solid var(--color-border);">
					<div>
						<label class="mb-1 block text-xs" style="color: var(--color-text-secondary);">Monto Mínimo</label>
						<input type="number" bind:value={minAmount} placeholder="0.00" class="w-full rounded-lg p-2 text-xs outline-none" style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);" />
					</div>
					<div>
						<label class="mb-1 block text-xs" style="color: var(--color-text-secondary);">Monto Máximo</label>
						<input type="number" bind:value={maxAmount} placeholder="1000.00" class="w-full rounded-lg p-2 text-xs outline-none" style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);" />
					</div>
					<div>
						<label class="mb-1 block text-xs" style="color: var(--color-text-secondary);">Desde</label>
						<input type="date" bind:value={startDate} class="w-full rounded-lg p-2 text-xs outline-none" style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);" />
					</div>
					<div>
						<label class="mb-1 block text-xs" style="color: var(--color-text-secondary);">Hasta</label>
						<input type="date" bind:value={endDate} class="w-full rounded-lg p-2 text-xs outline-none" style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);" />
					</div>
					<div class="col-span-2 text-right">
						<button onclick={() => { minAmount = null; maxAmount = null; startDate = ''; endDate = ''; }} class="text-xs underline" style="color: var(--color-text-secondary);">Limpiar Filtros</button>
					</div>
				</div>
			{/if}
			<TransactionHistory transactions={displayedTransactions()} />
		</div>
	{/if}
</div>