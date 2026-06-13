<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import type { Goal } from '$lib/schema';
	import { Plus, Target, CheckCircle2, Trash2, Download, Upload, PiggyBank } from '@lucide/svelte';
	import Toast from '$lib/components/Toast.svelte';

		let showingNewGoal = $state(false);
	let newGoalName = $state('');
	let newGoalAmount = $state('');

	// Modal para abonar
	let abonarGoalId = $state<string | null>(null);
	let abonarAmount = $state('');

	// Toast
	let toastMessage = $state('');
	let toastType = $state<'success' | 'error' | 'info'>('success');
	let showToast = $state(false);

	function showToastMsg(msg: string, type: 'success' | 'error' | 'info' = 'success') {
		toastMessage = msg;
		toastType = type;
		showToast = true;
	}

	function saveGoal() {
		if (!newGoalName || !newGoalAmount || isNaN(parseFloat(newGoalAmount))) {
			showToastMsg('Completa todos los campos', 'error');
			return;
		}

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
		showToastMsg(`🎯 Meta "${goal.name}" creada`);
	}

	function openAbonar(goalId: string) {
		abonarGoalId = goalId;
		abonarAmount = '';
	}

	function confirmAddSavings() {
		if (!abonarGoalId || !abonarAmount || isNaN(parseFloat(abonarAmount))) return;

		const amount = parseFloat(abonarAmount);
		financeStore.updateGoalProgress(abonarGoalId, amount);

		// Registrar como gasto de transferencia
		const goalName = financeStore.goals.find((g) => g.id === abonarGoalId)?.name;
		financeStore.addTransaction({
			id: crypto.randomUUID(),
			date: new Date().toISOString(),
			amount,
			categoryId: 'transfer',
			type: 'expense',
			note: `Transferencia a ahorro: ${goalName}`
		});

		abonarGoalId = null;
		abonarAmount = '';
		showToastMsg(`💰 S/ ${amount.toFixed(2)} transferidos a ${goalName}`);
	}

	function deleteGoal(id: string) {
		if (confirm('¿Eliminar esta meta de ahorro?')) {
			financeStore.deleteGoal(id);
			showToastMsg('Meta eliminada');
		}
	}

	function exportData() {
		const json = financeStore.exportToJSON();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `finanzas_backup_${new Date().toISOString().split('T')[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
		showToastMsg('📦 Backup exportado correctamente');
	}

	function importData() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async (e: any) => {
			const file = e.target?.files?.[0];
			if (!file) return;
			const text = await file.text();
			if (financeStore.importFromJSON(text)) {
				showToastMsg('📦 Datos importados correctamente');
			} else {
				showToastMsg('❌ Archivo inválido', 'error');
			}
		};
		input.click();
	}
</script>

<div class="animate-fade-in-up space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold" style="color: var(--color-text);">Guardadito</h1>
		<button onclick={() => showingNewGoal = !showingNewGoal} class="flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90" style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary);">
			<Plus size={24} />
		</button>
	</div>

	{#if showingNewGoal}
			<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
				<h2 class="mb-3 font-semibold" style="color: var(--color-text);">Nueva Meta</h2>
				<div class="space-y-3">
					<input type="text" bind:value={newGoalName} placeholder="Ej. Viaje, Laptop nueva" class="w-full rounded-xl p-3 text-sm outline-none transition-all" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"/>
					<input type="number" bind:value={newGoalAmount} placeholder="Monto objetivo (S/)" class="w-full rounded-xl p-3 text-sm outline-none transition-all" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"/>
					<div class="flex gap-2">
						<button onclick={() => showingNewGoal = false} class="flex-1 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95" style="background-color: var(--color-bg); color: var(--color-text-secondary);">Cancelar</button>
						<button onclick={saveGoal} class="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-all active:scale-95" style="background-color: var(--color-primary);">Crear</button>
					</div>
				</div>
			</div>
	{/if}

	<div class="space-y-4">
		{#if financeStore.goals.length === 0}
					<div class="rounded-2xl p-8 text-center shadow-sm" style="background-color: var(--color-surface); color: var(--color-text-secondary);">
						<Target size={48} class="mx-auto mb-4 opacity-50" />
						<p class="font-medium">Aún no tienes metas de ahorro.</p>
						<p class="mt-2 text-xs">Usa el botón + para crear tu primer "Guardadito".</p>
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