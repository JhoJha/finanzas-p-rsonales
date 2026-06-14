<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { ArrowDown, ArrowUp, Wallet, PiggyBank, TrendingUp, Target, Repeat } from '@lucide/svelte';
	import Chart from '$lib/components/Chart.svelte';
	import TransactionHistory from '$lib/components/TransactionHistory.svelte';

	let summary = $derived(financeStore.summary);

	// Datos para gráfico pastel de gastos
	let expensesByCategory = $derived(financeStore.getExpensesByCategory('all'));

	let pieLabels = $derived(expensesByCategory.map((c) => c.name));
	let pieData = $derived(expensesByCategory.map((c) => c.amount));
	let pieColors = $derived(
		expensesByCategory.map((c) => {
			const colorMap: Record<string, string> = {
				'orange-500': '#f97316',
				'blue-500': '#3b82f6',
				'green-500': '#22c55e',
				'purple-500': '#a855f7',
				'pink-500': '#ec4899',
				'yellow-500': '#eab308',
				'gray-500': '#6b7280',
				'red-500': '#ef4444'
			};
			// Extraer el color del string 'bg-xxx'
			for (const [key, val] of Object.entries(colorMap)) {
				if (c.color.includes(key)) return val;
			}
			return '#6b7280';
		})
	);

	// Últimas 5 transacciones
	let recentTransactions = $derived([...financeStore.transactions].reverse().slice(0, 5));

	let hasExpenses = $derived(summary.expenses > 0);
</script>

<div class="animate-fade-in-up space-y-5">
	<!-- Main Balance -->
	<div
		class="flex flex-col items-center justify-center rounded-2xl p-6 shadow-sm"
		style="background-color: var(--color-surface);"
	>
		<span class="text-sm font-medium" style="color: var(--color-text-secondary);">Saldo Total (Todas las cuentas)</span>
		<span
			class="text-4xl font-bold"
			style="color: {summary.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};"
		>
			S/ {summary.balance.toFixed(2)}
		</span>
	</div>

	<!-- Cuentas / Billeteras -->
	<div class="flex gap-4 overflow-x-auto pb-2 snap-x" style="scrollbar-width: none; -ms-overflow-style: none;">
		{#each financeStore.accounts as account}
			<div 
				class="min-w-[160px] flex-shrink-0 snap-start rounded-2xl p-5 shadow-sm text-white relative overflow-hidden"
				style="background: {account.type === 'bank' ? 'var(--color-primary)' : account.type === 'credit' ? 'var(--color-danger)' : 'var(--color-success)'};"
			>
				<div class="absolute -right-4 -top-4 rounded-full bg-white opacity-10" style="width: 64px; height: 64px;"></div>
				<div class="mb-2 flex items-center justify-between relative z-10">
					<span class="text-sm font-medium opacity-90">{account.name}</span>
					<Wallet size={16} />
				</div>
				<div class="text-xl font-bold relative z-10">S/ {account.balance.toFixed(2)}</div>
			</div>
		{/each}
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-2 gap-4">
		<div class="rounded-2xl p-4 shadow-sm" style="background-color: var(--color-surface);">
			<div class="mb-2 flex items-center justify-between">
				<div class="rounded-full p-2" style="background-color: color-mix(in srgb, var(--color-success) 20%, transparent); color: var(--color-success);">
					<ArrowUp size={20} />
				</div>
			</div>
			<span class="text-xs font-medium" style="color: var(--color-text-secondary);">Ingresos</span>
			<div class="text-lg font-bold" style="color: var(--color-text);">S/ {summary.income.toFixed(2)}</div>
		</div>

		<div class="rounded-2xl p-4 shadow-sm" style="background-color: var(--color-surface);">
			<div class="mb-2 flex items-center justify-between">
				<div class="rounded-full p-2" style="background-color: color-mix(in srgb, var(--color-danger) 20%, transparent); color: var(--color-danger);">
					<ArrowDown size={20} />
				</div>
			</div>
			<span class="text-xs font-medium" style="color: var(--color-text-secondary);">Gastos</span>
			<div class="text-lg font-bold" style="color: var(--color-text);">S/ {summary.expenses.toFixed(2)}</div>
		</div>
	</div>

	<!-- Herramientas Avanzadas -->
	<div class="grid grid-cols-2 gap-4">
		<a href="/presupuestos" class="flex flex-col gap-2 rounded-2xl p-4 shadow-sm transition-all active:scale-95" style="background-color: var(--color-surface);">
			<div class="w-fit rounded-full p-2" style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary);">
				<Target size={20} />
			</div>
			<span class="text-sm font-semibold" style="color: var(--color-text);">Presupuestos</span>
		</a>
		<a href="/recurrentes" class="flex flex-col gap-2 rounded-2xl p-4 shadow-sm transition-all active:scale-95" style="background-color: var(--color-surface);">
			<div class="w-fit rounded-full p-2" style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary);">
				<Repeat size={20} />
			</div>
			<span class="text-sm font-semibold" style="color: var(--color-text);">Recurrentes</span>
		</a>
	</div>

	<!-- Gráfico de gastos por categoría -->
	{#if hasExpenses}
		<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface);">
			<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold" style="color: var(--color-text);">
				<TrendingUp size={20} style="color: var(--color-primary);" />
				Gastos por categoría
			</h2>
			<Chart
				type="doughnut"
				labels={pieLabels}
				datasets={[
					{
						label: 'Gastos',
						data: pieData,
						backgroundColor: pieColors
					}
				]}
				height={240}
			/>
		</div>
	{/if}

	<!-- Savings Card -->
	<div
		class="rounded-2xl p-5 shadow-sm text-white"
		style="background: var(--gradient-header);"
	>
		<div class="mb-2 flex items-center justify-between">
			<span class="text-sm opacity-90">Ahorro Actual</span>
			<div class="rounded-full p-2" style="background-color: rgba(255,255,255,0.2);">
				<PiggyBank size={20} />
			</div>
		</div>
		<div class="text-2xl font-bold">S/ {summary.savings.toFixed(2)}</div>
		<p class="mt-1 text-xs opacity-75">
			{financeStore.goals.length > 0
				? `${financeStore.goals.length} meta${financeStore.goals.length > 1 ? 's' : ''} de ahorro activa${financeStore.goals.length > 1 ? 's' : ''}`
				: 'Crea tu primera meta en "Guardadito"'}
		</p>
	</div>

	<!-- Recent Transactions -->
	<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface);">
		<h2 class="mb-4 text-lg font-semibold" style="color: var(--color-text);">
			Actividad Reciente
		</h2>
		<TransactionHistory transactions={recentTransactions} />
	</div>
</div>
