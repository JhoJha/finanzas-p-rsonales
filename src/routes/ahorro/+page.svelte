<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import type { Goal } from '$lib/schema';
	import { Plus, Target, CheckCircle2 } from '@lucide/svelte';

	let showingNewGoal = $state(false);
	let newGoalName = $state('');
	let newGoalAmount = $state('');

	function saveGoal() {
		if (!newGoalName || !newGoalAmount || isNaN(parseFloat(newGoalAmount))) return;
		
		const goal: Goal = {
			id: crypto.randomUUID(),
			name: newGoalName,
			targetAmount: parseFloat(newGoalAmount),
			currentAmount: 0
		};
		financeStore.addGoal(goal);
		
		showingNewGoal = false;
		newGoalName = '';
		newGoalAmount = '';
	}
	
	function addSavings(id: string) {
		const amount = prompt('¿Cuánto quieres transferir a este objetivo?');
		if (amount && !isNaN(parseFloat(amount))) {
			financeStore.updateGoalProgress(id, parseFloat(amount));
			
			// Si agregamos al ahorro, deberíamos restarlo del balance global agregando un gasto de transferencia
			financeStore.addTransaction({
				id: crypto.randomUUID(),
				date: new Date().toISOString(),
				amount: parseFloat(amount),
				categoryId: 'transfer', // This would need special handling, but for now we skip or just add note
				type: 'expense',
				note: `Transferencia a ahorro: ${financeStore.goals.find(g => g.id === id)?.name}`
			});
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900">Guardadito</h1>
		<button onclick={() => showingNewGoal = !showingNewGoal} class="rounded-full bg-blue-100 p-2 text-blue-600">
			<Plus size={24} />
		</button>
	</div>

	{#if showingNewGoal}
		<div class="rounded-2xl bg-white p-5 shadow-inner border border-blue-100">
			<h2 class="mb-3 font-semibold text-gray-800">Nueva Meta</h2>
			<div class="space-y-3">
				<input type="text" bind:value={newGoalName} placeholder="Ej. Viaje, Laptop nueva" class="w-full rounded-lg border p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"/>
				<input type="number" bind:value={newGoalAmount} placeholder="Monto objetivo (S/)" class="w-full rounded-lg border p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"/>
				<div class="flex gap-2">
					<button onclick={() => showingNewGoal = false} class="flex-1 rounded-lg bg-gray-100 py-3 text-sm font-semibold text-gray-600">Cancelar</button>
					<button onclick={saveGoal} class="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white">Crear</button>
				</div>
			</div>
		</div>
	{/if}

	<div class="space-y-4">
		{#if financeStore.goals.length === 0}
			<div class="rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">
				<Target size={48} class="mx-auto mb-4 opacity-50" />
				<p>Aún no tienes metas de ahorro.</p>
				<p class="text-xs mt-2">Usa el botón + para crear tu primer "Guardadito".</p>
			</div>
		{:else}
			{#each financeStore.goals as goal}
				{@const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))}
				<div class="rounded-2xl bg-white p-5 shadow-sm">
					<div class="mb-2 flex items-center justify-between">
						<h3 class="font-semibold text-gray-900">{goal.name}</h3>
						{#if percent >= 100}
							<CheckCircle2 class="text-green-500" size={20} />
						{/if}
					</div>
					
					<div class="mb-4 mt-2">
						<div class="flex justify-between text-xs text-gray-500 mb-1">
							<span>S/ {goal.currentAmount.toFixed(2)}</span>
							<span>S/ {goal.targetAmount.toFixed(2)}</span>
						</div>
						<div class="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
							<div class="h-full {percent >= 100 ? 'bg-green-500' : 'bg-blue-600'} transition-all duration-500" style="width: {percent}%"></div>
						</div>
						<p class="mt-1 text-right text-xs font-medium {percent >= 100 ? 'text-green-600' : 'text-blue-600'}">{percent}%</p>
					</div>

					{#if percent < 100}
						<button onclick={() => addSavings(goal.id)} class="w-full rounded-lg bg-blue-50 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
							Abonar
						</button>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>