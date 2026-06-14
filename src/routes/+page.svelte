<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { ArrowDown, ArrowUp, Wallet, PiggyBank, TrendingUp, Target, Repeat, Calendar as CalendarIcon, HandCoins, CreditCard, Wifi, Heart, Zap, DollarSign } from '@lucide/svelte';
	import Chart from '$lib/components/Chart.svelte';
	import TransactionHistory from '$lib/components/TransactionHistory.svelte';
	import { getColorHex } from '$lib/utils/colors';

	let summary = $derived(financeStore.summary);
	let health = $derived(financeStore.getMonthlyHealthMetrics());

	// Datos para gráfico pastel de gastos
	let expensesByCategory = $derived(financeStore.getExpensesByCategory('all'));

	let pieLabels = $derived(expensesByCategory.map((c) => c.name));
	let pieData = $derived(expensesByCategory.map((c) => c.amount));
	let pieColors = $derived(
		expensesByCategory.map((c) => getColorHex(c.color))
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
			class="text-5xl font-extrabold tracking-tight"
			style="background: {summary.balance >= 0 ? 'linear-gradient(135deg, var(--color-primary), var(--color-accent))' : 'linear-gradient(135deg, var(--color-danger), #f43f5e)'}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
		>
			S/ {summary.balance.toFixed(2)}
		</span>
	</div>

	<!-- Cuentas / Billeteras (Tarjetas Realistas) -->
	<div class="flex gap-4 overflow-x-auto pb-4 pt-2 snap-x" style="scrollbar-width: none; -ms-overflow-style: none;">
		{#each financeStore.accounts as account}
			<div 
				class="min-w-[260px] flex-shrink-0 snap-start rounded-3xl p-5 shadow-lg text-white relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl"
				style="background: {account.type === 'bank' ? 'linear-gradient(135deg, #1e3a8a, #3b82f6)' : account.type === 'credit' ? 'linear-gradient(135deg, #7f1d1d, #ef4444)' : 'linear-gradient(135deg, #14532d, #22c55e)'}; box-shadow: 0 10px 25px -5px {account.type === 'bank' ? 'rgba(59, 130, 246, 0.4)' : account.type === 'credit' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'};"
			>
				<!-- Decoración Glassmorphism (Círculos difusos) -->
				<div class="absolute -right-10 -top-10 rounded-full bg-white opacity-10 blur-xl" style="width: 120px; height: 120px;"></div>
				<div class="absolute -left-10 -bottom-10 rounded-full bg-white opacity-5 blur-xl" style="width: 100px; height: 100px;"></div>
				
				<div class="mb-4 flex items-start justify-between relative z-10">
					<div>
						<span class="text-xs font-medium uppercase tracking-widest opacity-80">{account.name}</span>
						<div class="mt-1 flex items-center gap-2 opacity-90">
							<div class="h-6 w-8 rounded bg-yellow-400/80 shadow-sm border border-yellow-300/50"></div> <!-- Chip sim -->
							<Wifi size={18} class="rotate-90" />
						</div>
					</div>
					<CreditCard size={24} class="opacity-80" />
				</div>
				
				<div class="mt-4 relative z-10">
					<div class="text-sm font-light opacity-80 mb-1">Saldo Disponible</div>
					<div class="text-3xl font-extrabold tracking-tight">S/ {account.balance.toFixed(2)}</div>
				</div>
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

	<!-- Salud Financiera del Mes -->
	{#if health.monthIncome > 0}
		<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface);">
			<h2 class="mb-3 flex items-center gap-2 text-sm font-bold" style="color: var(--color-text);">
				<Heart size={16} style="color: var(--color-danger);" />
				Salud Financiera — Este Mes
			</h2>
			<div class="grid grid-cols-3 gap-3">
				<!-- Tasa de ahorro -->
				<div class="flex flex-col items-center justify-center rounded-xl p-3" style="background-color: var(--color-bg);">
					<div class="text-xl font-extrabold" style="color: {health.savingsRate >= 20 ? 'var(--color-success)' : health.savingsRate >= 0 ? 'var(--color-warning, #f59e0b)' : 'var(--color-danger)'};"
					>{health.savingsRate}%</div>
					<div class="mt-0.5 text-center text-xs" style="color: var(--color-text-secondary);">Tasa de ahorro</div>
				</div>
				<!-- Proyección cierre de mes -->
				<div class="flex flex-col items-center justify-center rounded-xl p-3" style="background-color: var(--color-bg);">
					<div class="text-sm font-extrabold leading-tight" style="color: {health.projectedNet >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};"
					>{health.projectedNet >= 0 ? '' : '-'}S/ {Math.abs(health.projectedNet).toFixed(0)}</div>
					<div class="mt-0.5 text-center text-xs" style="color: var(--color-text-secondary);">Proyección<br/>fin de mes</div>
				</div>
				<!-- Presupuesto diario -->
				<div class="flex flex-col items-center justify-center rounded-xl p-3" style="background-color: var(--color-bg);">
					<div class="text-sm font-extrabold leading-tight" style="color: {health.dailyBudgetLeft >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};"
					>S/ {Math.abs(health.dailyBudgetLeft).toFixed(0)}</div>
					<div class="mt-0.5 text-center text-xs" style="color: var(--color-text-secondary);">Disponible<br/>/día ({health.daysLeft}d)</div>
				</div>
			</div>
			<!-- Barra de tasa de ahorro -->
			<div class="mt-3 h-2 w-full overflow-hidden rounded-full" style="background-color: var(--color-bg);">
				<div
					class="h-full rounded-full transition-all duration-700"
					style="width: {Math.min(Math.max(health.savingsRate, 0), 100)}%; background-color: {health.savingsRate >= 20 ? 'var(--color-success)' : health.savingsRate >= 0 ? 'var(--color-warning, #f59e0b)' : 'var(--color-danger)'};"
				></div>
			</div>
			<p class="mt-1.5 text-xs" style="color: var(--color-text-secondary);">
				{#if health.savingsRate >= 20}✅ ¡Excelente! Estás ahorrando más del 20% de tus ingresos.
				{:else if health.savingsRate >= 0}⚠️ Tasa de ahorro baja. Intenta reducir gastos.
				{:else}🚨 Estás gastando más de lo que ingresas este mes.
				{/if}
			</p>
		</div>
	{/if}

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
		<a href="/deudas" class="flex flex-col gap-2 rounded-2xl p-4 shadow-sm transition-all active:scale-95" style="background-color: var(--color-surface);">
			<div class="w-fit rounded-full p-2" style="background-color: color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent); color: var(--color-warning, #f59e0b);">
				<HandCoins size={20} />
			</div>
			<span class="text-sm font-semibold" style="color: var(--color-text);">Deudas</span>
		</a>
		<a href="/calendario" class="flex flex-col gap-2 rounded-2xl p-4 shadow-sm transition-all active:scale-95" style="background-color: var(--color-surface);">
			<div class="w-fit rounded-full p-2" style="background-color: color-mix(in srgb, var(--color-success) 15%, transparent); color: var(--color-success);">
				<CalendarIcon size={20} />
			</div>
			<span class="text-sm font-semibold" style="color: var(--color-text);">Calendario</span>
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
