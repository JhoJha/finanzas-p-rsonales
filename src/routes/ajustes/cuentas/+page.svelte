<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { ArrowLeft, Plus, Trash2 } from '@lucide/svelte';

	let accounts = $derived(financeStore.accounts);
	
	let showForm = $state(false);
	let newName = $state('');
	let newType = $state<'cash'|'bank'|'credit'>('cash');
	let newBalance = $state(0);
	let newCurrency = $state('PEN');

	function saveAccount() {
		if (!newName.trim()) {
			toastStore.add('El nombre es requerido', 'error');
			return;
		}
		
		const created = financeStore.addAccount({
			id: crypto.randomUUID(),
			name: newName.trim(),
			type: newType,
			initialBalance: newBalance,
			balance: newBalance,
			currency: newCurrency
		});
		if (!created) return;
		
		toastStore.add('Cuenta creada', 'success');
		showForm = false;
		newName = '';
		newBalance = 0;
	}

	function deleteAccount(id: string) {
		if (accounts.length <= 1) {
			toastStore.add('Debes tener al menos una cuenta', 'error');
			return;
		}
		if (confirm('¿Eliminar esta cuenta y todas sus transacciones asociadas?')) {
			try {
				const deleted = financeStore.deleteAccount(id);
				if (!deleted) return;
				toastStore.add('Cuenta eliminada', 'success');
			} catch (e: any) {
				toastStore.add(e.message, 'error');
			}
		}
	}
</script>

<div class="animate-fade-in-up space-y-6">
	<div class="flex items-center gap-3">
		<a href="/ajustes" class="rounded-full p-2 hover:bg-black/5" style="color: var(--color-text);">
			<ArrowLeft size={24} />
		</a>
		<h1 class="text-2xl font-bold" style="color: var(--color-text);">Mis Cuentas</h1>
	</div>

	<div class="space-y-3">
		{#each accounts as account}
			<div class="flex items-center justify-between rounded-xl p-4 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
				<div>
					<p class="font-semibold" style="color: var(--color-text);">{account.name}</p>
					<p class="text-xs" style="color: var(--color-text-secondary);">
						{account.type === 'cash' ? 'Efectivo' : account.type === 'bank' ? 'Banco' : 'Crédito'} • {account.currency || 'PEN'}
					</p>
				</div>
				<div class="flex items-center gap-4">
					<span class="font-bold" style="color: var(--color-text);">
						{financeStore.formatCurrency(account.balance, account.currency)}
					</span>
					<button onclick={() => deleteAccount(account.id)} class="text-red-500 hover:opacity-80">
						<Trash2 size={18} />
					</button>
				</div>
			</div>
		{/each}
	</div>

	{#if showForm}
		<div class="animate-fade-in-up rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
			<h2 class="mb-4 font-semibold" style="color: var(--color-text);">Nueva Cuenta</h2>
			<div class="space-y-3">
				<div>
					<label for="account-name" class="mb-1 block text-xs" style="color: var(--color-text-secondary);">Nombre</label>
					<input id="account-name" type="text" bind:value={newName} class="w-full rounded-xl p-2 outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" />
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="account-type" class="mb-1 block text-xs" style="color: var(--color-text-secondary);">Tipo</label>
						<select id="account-type" bind:value={newType} class="w-full rounded-xl p-2 outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);">
							<option value="cash">Efectivo</option>
							<option value="bank">Banco</option>
							<option value="credit">Crédito</option>
						</select>
					</div>
					<div>
						<label for="account-currency" class="mb-1 block text-xs" style="color: var(--color-text-secondary);">Moneda (Ej. USD, EUR)</label>
						<input id="account-currency" type="text" bind:value={newCurrency} class="w-full rounded-xl p-2 outline-none uppercase" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" />
					</div>
				</div>
				<div>
					<label for="account-initial-balance" class="mb-1 block text-xs" style="color: var(--color-text-secondary);">Saldo Inicial</label>
					<input id="account-initial-balance" type="number" bind:value={newBalance} class="w-full rounded-xl p-2 outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" />
				</div>
				<div class="mt-4 flex gap-2">
					<button onclick={() => (showForm = false)} class="flex-1 rounded-xl py-2 font-semibold" style="background-color: var(--color-bg); color: var(--color-text);">Cancelar</button>
					<button onclick={saveAccount} class="flex-1 rounded-xl py-2 font-semibold text-white" style="background-color: var(--color-primary);">Guardar</button>
				</div>
			</div>
		</div>
	{:else}
		<button
			onclick={() => (showForm = true)}
			class="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold transition-all active:scale-95"
			style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary);"
		>
			<Plus size={20} /> Añadir Cuenta
		</button>
	{/if}
</div>
