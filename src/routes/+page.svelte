<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { ArrowDown, ArrowUp, DollarSign, Wallet } from '@lucide/svelte';

	let summary = $derived(financeStore.summary);
</script>

<div class="space-y-6">
	<!-- Main Balance -->
	<div class="flex flex-col items-center justify-center rounded-2xl bg-white p-6 shadow-sm">
		<span class="text-sm text-gray-500">Saldo Total</span>
		<span class="text-4xl font-bold {summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}">
			S/ {summary.balance.toFixed(2)}
		</span>
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-2 gap-4">
		<!-- Income -->
		<div class="rounded-2xl bg-white p-4 shadow-sm">
			<div class="mb-2 flex items-center justify-between">
				<div class="rounded-full bg-green-100 p-2 text-green-600">
					<ArrowUp size={20} />
				</div>
			</div>
			<span class="text-xs text-gray-500">Ingresos</span>
			<div class="text-lg font-bold text-gray-900">S/ {summary.income.toFixed(2)}</div>
		</div>

		<!-- Expenses -->
		<div class="rounded-2xl bg-white p-4 shadow-sm">
			<div class="mb-2 flex items-center justify-between">
				<div class="rounded-full bg-red-100 p-2 text-red-600">
					<ArrowDown size={20} />
				</div>
			</div>
			<span class="text-xs text-gray-500">Gastos</span>
			<div class="text-lg font-bold text-gray-900">S/ {summary.expenses.toFixed(2)}</div>
		</div>
	</div>

	<!-- Savings Card -->
	<div class="rounded-2xl bg-blue-600 p-5 text-white shadow-sm">
		<div class="mb-2 flex items-center justify-between">
			<span class="text-sm opacity-90">Ahorro Actual</span>
			<div class="rounded-full bg-blue-500 p-2">
				<Wallet size={20} />
			</div>
		</div>
		<div class="text-2xl font-bold">S/ {summary.savings.toFixed(2)}</div>
		<p class="mt-4 text-xs opacity-75">Tus metas de "Guardadito" van en progreso.</p>
	</div>

	<!-- Recent Transactions -->
	<div class="rounded-2xl bg-white p-5 shadow-sm">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Actividad Reciente</h2>
		{#if financeStore.transactions.length === 0}
			<p class="text-center text-sm text-gray-500 py-4">No hay transacciones aún.</p>
		{:else}
			<div class="space-y-4">
				{#each [...financeStore.transactions].reverse().slice(0, 5) as t (t.id)}
					<div class="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
						<div class="flex items-center space-x-3">
							<div class={`flex h-10 w-10 items-center justify-center rounded-full text-white bg-gray-500`}>
								<DollarSign size={18} />
							</div>
							<div>
								<p class="font-medium text-gray-900">{t.note || 'Sin nota'}</p>
								<p class="text-xs text-gray-500">{new Date(t.date).toLocaleDateString()}</p>
							</div>
						</div>
						<span class="font-semibold {t.type === 'income' ? 'text-green-600' : 'text-red-600'}">
							{t.type === 'income' ? '+' : '-'}S/ {t.amount.toFixed(2)}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
