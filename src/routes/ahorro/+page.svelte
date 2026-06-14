<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import type { Goal } from '$lib/schema';
	import { INTERNAL_CATEGORY_SAVINGS } from '$lib/schema';
	import { Plus, Target, CheckCircle2, Trash2, Download, Upload, PiggyBank, X } from '@lucide/svelte';

	let showingNewGoal = $state(false);
	let newGoalName = $state('');
	let newGoalAmount = $state('');

	// Modal para abonar
	let abonarGoalId = $state<string | null>(null);
	let abonarAmount = $state('');
	let abonarAccountId = $state(financeStore.accounts[0]?.id || 'default-cash');

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
			toastStore.add('Completa todos los campos', 'error');
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
		toastStore.add(`🎯 Meta "${goal.name}" creada`);
	}

	function openAbonar(goalId: string) {
		abonarGoalId = goalId;
		abonarAmount = '';
		abonarAccountId = financeStore.accounts[0]?.id || 'default-cash';
	}

	function confirmAddSavings() {
		if (!abonarGoalId || !abonarAmount || isNaN(parseFloat(abonarAmount))) return;

		const amount = parseFloat(abonarAmount);
		financeStore.updateGoalProgress(abonarGoalId, amount);

		// Registrar como gasto desde la cuenta elegida con categoría interna de ahorro
		const goalName = financeStore.goals.find((g) => g.id === abonarGoalId)?.name;
		financeStore.addTransaction({
			id: crypto.randomUUID(),
			date: new Date().toISOString(),
			amount,
			categoryId: INTERNAL_CATEGORY_SAVINGS,
			accountId: abonarAccountId,
			type: 'expense',
			note: `Ahorro: ${goalName}`
		});

		abonarGoalId = null;
		abonarAmount = '';
		toastStore.add(`💰 S/ ${amount.toFixed(2)} transferidos a ${goalName}`);
	}

	function deleteGoal(id: string) {
		if (confirm('¿Eliminar esta meta de ahorro?')) {
			financeStore.deleteGoal(id);
			toastStore.add('Meta eliminada', 'info');
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
		toastStore.add('📦 Backup exportado correctamente');
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
				toastStore.add('📦 Datos importados correctamente');
			} else {
				toastStore.add('❌ Archivo inválido o corrupto', 'error');
			}
		};
		input.click();
	}
</script>

<div class="animate-fade-in-up space-y-6">
	<!-- Encabezado y botón de agregar -->
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold" style="color: var(--color-text);">Guardadito</h1>
		<button
			onclick={() => (showingNewGoal = !showingNewGoal)}
			class="flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90"
			style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary);"
		>
			<Plus size={24} />
		</button>
	</div>

	<!-- Botones de Backup/Restaurar -->
	<div class="flex gap-2">
		<button
			onclick={exportData}
			class="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all active:scale-95"
			style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);"
		>
			<Download size={14} /> Exportar Backup
		</button>
		<button
			onclick={importData}
			class="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all active:scale-95"
			style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);"
		>
			<Upload size={14} /> Importar Backup
		</button>
	</div>

	<!-- Formulario de Nueva Meta -->
	{#if showingNewGoal}
		<div
			class="rounded-2xl p-5 shadow-sm"
			style="background-color: var(--color-surface); border: 1px solid var(--color-border);"
		>
			<h2 class="mb-3 font-semibold" style="color: var(--color-text);">Nueva Meta</h2>
			<div class="space-y-3">
				<input
					type="text"
					bind:value={newGoalName}
					placeholder="Ej. Viaje, Laptop nueva"
					class="w-full rounded-xl p-3 text-sm outline-none transition-all"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
				<input
					type="number"
					bind:value={newGoalAmount}
					placeholder="Monto objetivo (S/)"
					class="w-full rounded-xl p-3 text-sm outline-none transition-all"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
				<div class="flex gap-2">
					<button
						onclick={() => (showingNewGoal = false)}
						class="flex-1 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95"
						style="background-color: var(--color-bg); color: var(--color-text-secondary);"
					>
						Cancelar
					</button>
					<button
						onclick={saveGoal}
						class="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-all active:scale-95"
						style="background-color: var(--color-primary);"
					>
						Crear
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Lista de Metas -->
	<div class="space-y-4">
		{#if financeStore.goals.length === 0}
			<div
				class="rounded-2xl p-8 text-center shadow-sm"
				style="background-color: var(--color-surface); color: var(--color-text-secondary);"
			>
				<Target size={48} class="mx-auto mb-4 opacity-50" />
				<p class="font-medium">Aún no tienes metas de ahorro.</p>
				<p class="mt-2 text-xs">Usa el botón + para crear tu primer "Guardadito".</p>
			</div>
		{:else}
			{#each financeStore.goals as goal}
				{@const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))}
				<div
					class="rounded-2xl p-5 shadow-sm"
					style="background-color: var(--color-surface); border: 1px solid var(--color-border);"
				>
					<div class="mb-2 flex items-center justify-between">
						<h3 class="font-semibold" style="color: var(--color-text);">{goal.name}</h3>
						<div class="flex items-center gap-3">
							{#if percent >= 100}
								<CheckCircle2 class="text-green-500" size={20} />
							{/if}
							<button
								onclick={() => deleteGoal(goal.id)}
								class="text-red-500 transition-transform active:scale-90 hover:opacity-80"
								aria-label="Eliminar meta"
							>
								<Trash2 size={18} />
							</button>
						</div>
					</div>

					<div class="mb-4 mt-2">
						<div class="flex justify-between text-xs mb-1" style="color: var(--color-text-secondary);">
							<span>S/ {goal.currentAmount.toFixed(2)}</span>
							<span>S/ {goal.targetAmount.toFixed(2)}</span>
						</div>
						<div class="h-3 w-full rounded-full overflow-hidden" style="background-color: var(--color-bg);">
							<div
								class="h-full transition-all duration-500"
								style="width: {percent}%; background-color: {percent >= 100 ? 'var(--color-success)' : 'var(--color-primary)'};"
							></div>
						</div>
						<p
							class="mt-1 text-right text-xs font-semibold"
							style="color: {percent >= 100 ? 'var(--color-success)' : 'var(--color-primary)'};"
						>
							{percent}%
						</p>
					</div>

					{#if percent < 100}
						<button
							onclick={() => openAbonar(goal.id)}
							class="w-full rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-95"
							style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary);"
						>
							Abonar
						</button>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>

<!-- Modal para Abonar -->
{#if abonarGoalId !== null}
	{@const activeGoal = financeStore.goals.find((g) => g.id === abonarGoalId)}
	<!-- Overlay -->
	<div
		class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
		onclick={() => (abonarGoalId = null)}
		role="presentation"
	></div>

	<!-- Panel -->
	<div
		class="fixed bottom-0 left-0 right-0 z-50 animate-slide-down rounded-t-3xl px-6 pb-10 pt-6 shadow-2xl"
		style="background-color: var(--color-surface); color: var(--color-text);"
	>
		<div class="mb-6 flex items-center justify-between">
			<h2 class="text-lg font-bold">Abonar a "{activeGoal?.name}"</h2>
			<button
				onclick={() => (abonarGoalId = null)}
				class="flex h-8 w-8 items-center justify-center rounded-full"
				style="background-color: var(--color-bg);"
			>
				<X size={18} />
			</button>
		</div>

		<div class="space-y-4">
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);">Monto a ahorrar (S/)</label>
				<input
					type="number"
					bind:value={abonarAmount}
					placeholder="0.00"
					class="mt-1 w-full rounded-xl p-3.5 text-lg font-bold outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
			</div>

			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);">Descontar de cuenta</label>
				<select
					bind:value={abonarAccountId}
					class="mt-1 w-full rounded-xl p-3.5 text-sm outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				>
					{#each financeStore.accounts as acc}
						<option value={acc.id}>{acc.name} (S/ {acc.balance.toFixed(2)})</option>
					{/each}
				</select>
			</div>

			<div class="flex gap-2">
				<button
					onclick={() => (abonarGoalId = null)}
					class="flex-1 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95"
					style="background-color: var(--color-bg); color: var(--color-text-secondary);"
				>
					Cancelar
				</button>
				<button
					onclick={confirmAddSavings}
					class="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-all active:scale-95"
					style="background-color: var(--color-primary);"
				>
					Confirmar
				</button>
			</div>
		</div>
	</div>
{/if}