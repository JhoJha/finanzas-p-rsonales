<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { GoalSchema } from '$lib/schema';
	import { dateFromDateOnly } from '$lib/utils/date';
	import { Plus, Target, CheckCircle2, Trash2, PiggyBank, X, Calendar } from '@lucide/svelte';

	let showingNewGoal = $state(false);
	let newGoalName = $state('');
	let newGoalAmount = $state('');
	let newGoalDeadline = $state(''); // YYYY-MM-DD

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

		const goal = {
			id: crypto.randomUUID(),
			name: newGoalName,
			targetAmount: parseFloat(newGoalAmount),
			currentAmount: 0,
			deadline: newGoalDeadline || undefined
		};

		const parsed = GoalSchema.safeParse(goal);
		if (!parsed.success) {
			toastStore.add('Verifica que el nombre y monto sean válidos', 'error');
			return;
		}

		financeStore.addGoal(parsed.data);

		showingNewGoal = false;
		newGoalName = '';
		newGoalAmount = '';
		newGoalDeadline = '';
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
		if (!financeStore.contributeToGoal(abonarGoalId, amount, abonarAccountId)) {
			toastStore.add('No se pudo registrar el aporte a la meta.', 'error');
			return;
		}

		// Registrar como gasto desde la cuenta elegida con categoría interna de ahorro
		const goalName = financeStore.goals.find((g) => g.id === abonarGoalId)?.name;

		abonarGoalId = null;
		abonarAmount = '';
		toastStore.add(`💰 ${financeStore.formatCurrency(amount)} transferidos a ${goalName}`);
	}

	function deleteGoal(id: string) {
		if (confirm('¿Eliminar esta meta de ahorro?')) {
			financeStore.deleteGoal(id);
			toastStore.add('Meta eliminada', 'info');
		}
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
					placeholder="Monto objetivo (Moneda Base)"
					class="w-full rounded-xl p-3 text-sm outline-none transition-all"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
				<div class="flex items-center gap-2">
					<Calendar size={14} style="color: var(--color-text-secondary); flex-shrink: 0;" />
					<input
						type="date"
						bind:value={newGoalDeadline}
						min={new Date().toISOString().split('T')[0]}
						class="flex-1 rounded-xl p-3 text-xs outline-none transition-all"
						style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
						placeholder="Fecha límite (opcional)"
					/>
				</div>
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
							<span>{financeStore.formatCurrency(goal.currentAmount)}</span>
							<span>{financeStore.formatCurrency(goal.targetAmount)}</span>
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
						<!-- Fecha límite e info de aporte diario -->
						{#if goal.deadline && percent < 100}
							{@const deadlineDate = dateFromDateOnly(goal.deadline)}
							{@const daysLeft = Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000))}
							{@const remaining = goal.targetAmount - goal.currentAmount}
							{@const dailyNeeded = daysLeft > 0 ? remaining / daysLeft : null}
							<div class="mt-2 flex items-center justify-between rounded-lg px-3 py-2" style="background-color: {daysLeft <= 7 ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)' : 'var(--color-bg)'}; border: 1px solid {daysLeft <= 7 ? 'var(--color-danger)' : 'var(--color-border)'};">
								<div class="flex items-center gap-1.5">
									<Calendar size={12} style="color: {daysLeft <= 7 ? 'var(--color-danger)' : 'var(--color-text-secondary)'};" />
									<span class="text-xs font-medium" style="color: {daysLeft <= 7 ? 'var(--color-danger)' : 'var(--color-text-secondary)'};"
									>{daysLeft === 0 ? '¡Vence hoy!' : `${daysLeft} días`}</span>
								</div>
								{#if dailyNeeded !== null}
									<span class="text-xs font-semibold" style="color: var(--color-primary);">{financeStore.formatCurrency(dailyNeeded)}/día</span>
								{/if}
							</div>
						{/if}
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
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-20">Monto a ahorrar (Moneda Base)</label>
				<input id="a11y-20"
					type="number"
					bind:value={abonarAmount}
					placeholder="0.00"
					class="mt-1 w-full rounded-xl p-3.5 text-lg font-bold outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
			</div>

			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-21">Descontar de cuenta</label>
				<select id="a11y-21"
					bind:value={abonarAccountId}
					class="mt-1 w-full rounded-xl p-3.5 text-sm outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				>
					{#each financeStore.accounts as acc}
						<option value={acc.id}>{acc.name} ({financeStore.formatCurrency(acc.balance)})</option>
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
