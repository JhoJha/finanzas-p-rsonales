<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { HandCoins, Plus, CheckCircle2, AlertCircle } from '@lucide/svelte';

	let activeTab = $state<'i_owe' | 'owed_to_me'>('i_owe');
	let showAddModal = $state(false);

	// Form
	let contactName = $state('');
	let totalAmount = $state('');
	let dueDate = $state('');

	// Payment Form
	let showPayModal = $state<string | null>(null);
	let payAmount = $state('');
	let payAccountId = $state(financeStore.accounts[0]?.id || '');

	let filteredDebts = $derived(financeStore.debts.filter(d => d.type === activeTab));
	let totalPending = $derived(
		filteredDebts.filter(d => d.status === 'pending').reduce((acc, d) => acc + (d.totalAmount - d.paidAmount), 0)
	);

	function addDebt() {
		if (!contactName.trim() || !totalAmount || isNaN(parseFloat(totalAmount)) || parseFloat(totalAmount) <= 0) {
			toastStore.add('Campos inválidos', 'error');
			return;
		}

		financeStore.addDebt({
			id: crypto.randomUUID(),
			type: activeTab,
			contactName: contactName.trim(),
			totalAmount: parseFloat(totalAmount),
			paidAmount: 0,
			dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
			status: 'pending'
		});

		toastStore.add('Deuda registrada', 'success');
		showAddModal = false;
		contactName = '';
		totalAmount = '';
		dueDate = '';
	}

	function payDebt() {
		if (!showPayModal) return;
		if (!payAmount || isNaN(parseFloat(payAmount)) || parseFloat(payAmount) <= 0) {
			toastStore.add('Monto inválido', 'error');
			return;
		}

		financeStore.payDebt(showPayModal, parseFloat(payAmount), payAccountId);
		toastStore.add('Abono registrado', 'success');
		showPayModal = null;
		payAmount = '';
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
	}
</script>

<div class="animate-fade-in-up space-y-5">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold" style="color: var(--color-text);">Deudas y Préstamos</h1>
		<button
			onclick={() => (showAddModal = true)}
			class="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md transition-all active:scale-95"
			style="background-color: var(--color-primary);"
		>
			<Plus size={20} />
		</button>
	</div>

	<!-- Tabs -->
	<div class="flex rounded-xl p-1" style="background-color: var(--color-surface);">
		<button
			class="flex-1 rounded-lg py-2 text-sm font-semibold transition-all"
			style="background-color: {activeTab === 'i_owe' ? 'var(--color-danger)' : 'transparent'}; color: {activeTab === 'i_owe' ? 'white' : 'var(--color-text-secondary)'};"
			onclick={() => (activeTab = 'i_owe')}
		>
			Yo Debo
		</button>
		<button
			class="flex-1 rounded-lg py-2 text-sm font-semibold transition-all"
			style="background-color: {activeTab === 'owed_to_me' ? 'var(--color-success)' : 'transparent'}; color: {activeTab === 'owed_to_me' ? 'white' : 'var(--color-text-secondary)'};"
			onclick={() => (activeTab = 'owed_to_me')}
		>
			Me Deben
		</button>
	</div>

	<!-- Resumen -->
	<div class="rounded-2xl p-5 shadow-sm text-center" style="background-color: var(--color-surface);">
		<span class="text-sm font-medium" style="color: var(--color-text-secondary);">
			Total Pendiente ({activeTab === 'i_owe' ? 'por pagar' : 'por cobrar'})
		</span>
		<div class="text-3xl font-bold" style="color: {activeTab === 'i_owe' ? 'var(--color-danger)' : 'var(--color-success)'};">
			S/ {totalPending.toFixed(2)}
		</div>
	</div>

	<!-- Lista -->
	<div class="space-y-4">
		{#each filteredDebts as debt}
			{@const percent = Math.min((debt.paidAmount / debt.totalAmount) * 100, 100)}
			<div class="rounded-2xl p-5 shadow-sm relative overflow-hidden" style="background-color: var(--color-surface);">
				<div class="mb-3 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<HandCoins size={20} style="color: {debt.status === 'paid' ? 'var(--color-success)' : 'var(--color-text)'};" />
						<span class="font-bold text-lg" style="color: var(--color-text);">{debt.contactName}</span>
					</div>
					{#if debt.status === 'paid'}
						<span class="flex items-center gap-1 text-xs font-bold" style="color: var(--color-success);">
							<CheckCircle2 size={14} /> Pagado
						</span>
					{:else if debt.dueDate}
						<span class="flex items-center gap-1 text-xs font-medium" style="color: {new Date(debt.dueDate) < new Date() ? 'var(--color-danger)' : 'var(--color-text-secondary)'};">
							<AlertCircle size={14} /> Vence: {formatDate(debt.dueDate)}
						</span>
					{/if}
				</div>

				<div class="mb-1 flex justify-between text-sm font-medium">
					<span style="color: var(--color-text-secondary);">S/ {debt.paidAmount.toFixed(2)} abonado</span>
					<span style="color: var(--color-text);">S/ {debt.totalAmount.toFixed(2)}</span>
				</div>

				<!-- Barra de progreso -->
				<div class="mb-4 h-2 w-full overflow-hidden rounded-full" style="background-color: var(--color-bg);">
					<div
						class="h-full rounded-full transition-all duration-500"
						style="width: {percent}%; background-color: {percent === 100 ? 'var(--color-success)' : activeTab === 'i_owe' ? 'var(--color-danger)' : 'var(--color-success)'};"
					></div>
				</div>

				{#if debt.status === 'pending'}
					<button
						onclick={() => (showPayModal = debt.id)}
						class="w-full rounded-xl py-2 text-sm font-semibold transition-colors"
						style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary);"
					>
						Registrar Abono
					</button>
				{/if}
			</div>
		{/each}

		{#if filteredDebts.length === 0}
			<div class="rounded-2xl p-8 text-center text-sm" style="background-color: var(--color-surface); color: var(--color-text-secondary);">
				No hay deudas registradas aquí.
			</div>
		{/if}
	</div>
</div>

<!-- Modal Añadir -->
{#if showAddModal}
<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
	<div class="w-full animate-slide-up rounded-t-3xl p-6 shadow-2xl sm:max-w-md sm:rounded-3xl" style="background-color: var(--color-surface);">
		<h2 class="mb-4 text-xl font-bold" style="color: var(--color-text);">
			{activeTab === 'i_owe' ? 'Añadir Deuda' : 'Añadir Préstamo'}
		</h2>
		
		<div class="space-y-4">
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);">¿A quién o a qué entidad?</label>
				<input type="text" bind:value={contactName} placeholder="Ej. Juan, Tarjeta Ripley..." class="mt-1 w-full rounded-xl p-3 text-sm outline-none border" style="background-color: var(--color-bg); color: var(--color-text); border-color: var(--color-border);" />
			</div>
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);">Monto Total (S/)</label>
				<input type="number" bind:value={totalAmount} placeholder="0.00" class="mt-1 w-full rounded-xl p-3 text-lg font-bold outline-none border" style="background-color: var(--color-bg); color: var(--color-text); border-color: var(--color-border);" />
			</div>
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);">Fecha Límite (Opcional)</label>
				<input type="date" bind:value={dueDate} class="mt-1 w-full rounded-xl p-3 text-sm outline-none border" style="background-color: var(--color-bg); color: var(--color-text); border-color: var(--color-border);" />
			</div>

			<div class="mt-6 flex gap-3">
				<button onclick={() => (showAddModal = false)} class="flex-1 rounded-xl py-3 font-semibold text-gray-500" style="background-color: var(--color-bg);">Cancelar</button>
				<button onclick={addDebt} class="flex-1 rounded-xl py-3 font-bold text-white shadow-md" style="background-color: var(--color-primary);">Guardar</button>
			</div>
		</div>
	</div>
</div>
{/if}

<!-- Modal Abonar -->
{#if showPayModal}
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
	<div class="w-[90%] max-w-sm animate-fade-in-up rounded-3xl p-6 shadow-2xl" style="background-color: var(--color-surface);">
		<h2 class="mb-4 text-lg font-bold" style="color: var(--color-text);">Registrar Abono</h2>
		
		<div class="space-y-4">
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);">Monto a abonar (S/)</label>
				<input type="number" bind:value={payAmount} placeholder="0.00" class="mt-1 w-full rounded-xl p-3 text-lg font-bold outline-none border" style="background-color: var(--color-bg); color: var(--color-text); border-color: var(--color-border);" />
			</div>
			
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);">
					{activeTab === 'i_owe' ? 'Pagar desde:' : 'Recibir en:'}
				</label>
				<select bind:value={payAccountId} class="mt-1 w-full rounded-xl p-3 text-sm outline-none border" style="background-color: var(--color-bg); color: var(--color-text); border-color: var(--color-border);">
					{#each financeStore.accounts as acc}
						<option value={acc.id}>{acc.name} (S/ {acc.balance.toFixed(2)})</option>
					{/each}
				</select>
			</div>

			<div class="mt-6 flex gap-3">
				<button onclick={() => (showPayModal = null)} class="flex-1 rounded-xl py-3 font-semibold text-gray-500" style="background-color: var(--color-bg);">Cancelar</button>
				<button onclick={payDebt} class="flex-1 rounded-xl py-3 font-bold text-white shadow-md" style="background-color: {activeTab === 'i_owe' ? 'var(--color-danger)' : 'var(--color-success)'};">Confirmar</button>
			</div>
		</div>
	</div>
</div>
{/if}
