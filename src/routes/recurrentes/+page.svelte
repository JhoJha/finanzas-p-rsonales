<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { Repeat, Plus, Trash2 } from '@lucide/svelte';

	let type = $state<'expense' | 'income' | 'transfer'>('expense');
	let amount = $state('');
	let categoryId = $state(financeStore.categories.filter(c => c.type === 'expense')[0]?.id || '1');
	let accountId = $state(financeStore.accounts[0]?.id || 'default-cash');
	let toAccountId = $state(financeStore.accounts[1]?.id || 'default-cash');
	let frequency = $state<'daily' | 'weekly' | 'monthly'>('monthly');
	let note = $state('');
	let nextDate = $state(new Date().toISOString().split('T')[0]); // YYYY-MM-DD

	function addRecurring() {
		if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
			toastStore.add('Monto inválido', 'error');
			return;
		}

		if (!nextDate) {
			toastStore.add('Selecciona una fecha de inicio', 'error');
			return;
		}

		financeStore.addRecurringTransaction({
			id: crypto.randomUUID(),
			amount: parseFloat(amount),
			categoryId: type === 'transfer' ? 'transfer' : categoryId,
			accountId,
			toAccountId: type === 'transfer' ? toAccountId : undefined,
			note,
			type,
			frequency,
			nextDate: new Date(nextDate).toISOString()
		});

		toastStore.add('Transacción recurrente creada', 'success');
		amount = '';
		note = '';
	}

	function deleteRecurring(id: string) {
		financeStore.deleteRecurringTransaction(id);
		toastStore.add('Transacción recurrente eliminada', 'info');
	}

	function formatDate(isoString: string) {
		const d = new Date(isoString);
		return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
	}
</script>

<div class="animate-fade-in-up space-y-5">
	<h1 class="text-2xl font-bold" style="color: var(--color-text);">Recurrentes</h1>
	<p class="text-sm" style="color: var(--color-text-secondary);">
		Automatiza tus gastos fijos (como Netflix, internet) o ingresos fijos (salario).
	</p>

	<!-- Formulario -->
	<div class="rounded-2xl p-5 shadow-sm space-y-4" style="background-color: var(--color-surface);">
		<h2 class="border-b pb-2 text-sm font-semibold" style="color: var(--color-text); border-color: var(--color-border);">
			Nueva Transacción Recurrente
		</h2>

		<!-- Tipo -->
		<div class="flex gap-2">
			<button
				class="flex-1 rounded-lg py-2 text-xs font-semibold transition-all active:scale-95"
				style="background-color: {type === 'expense' ? 'color-mix(in srgb, var(--color-danger) 15%, transparent)' : 'var(--color-bg)'}; color: {type === 'expense' ? 'var(--color-danger)' : 'var(--color-text-secondary)'};"
				onclick={() => { type = 'expense'; categoryId = financeStore.categories.filter(c => c.type === 'expense')[0]?.id || '1'; }}
			>
				💸 Gasto
			</button>
			<button
				class="flex-1 rounded-lg py-2 text-xs font-semibold transition-all active:scale-95"
				style="background-color: {type === 'income' ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : 'var(--color-bg)'}; color: {type === 'income' ? 'var(--color-success)' : 'var(--color-text-secondary)'};"
				onclick={() => { type = 'income'; categoryId = financeStore.categories.filter(c => c.type === 'income')[0]?.id || '6'; }}
			>
				💰 Ingreso
			</button>
			<button
				class="flex-1 rounded-lg py-2 text-xs font-semibold transition-all active:scale-95"
				style="background-color: {type === 'transfer' ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-bg)'}; color: {type === 'transfer' ? 'var(--color-primary)' : 'var(--color-text-secondary)'};"
				onclick={() => { type = 'transfer'; }}
			>
				🔄 Transf.
			</button>
		</div>

		<!-- Monto y Frecuencia -->
		<div class="flex gap-2">
			<div class="flex-1">
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-6">Monto (S/)</label>
				<input id="a11y-6"
					type="number"
					bind:value={amount}
					placeholder="0.00"
					class="mt-1 w-full rounded-xl p-3 text-sm font-bold outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
			</div>
			<div class="flex-1">
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-7">Frecuencia</label>
				<select id="a11y-7"
					bind:value={frequency}
					class="mt-1 w-full rounded-xl p-3 text-sm outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				>
					<option value="daily">Diario</option>
					<option value="weekly">Semanal</option>
					<option value="biweekly">Quincenal (cada 14 días)</option>
					<option value="monthly">Mensual</option>
				</select>
			</div>
		</div>

		<!-- Fecha de inicio -->
		<div>
			<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-8">Próximo Cobro/Pago</label>
				<input id="a11y-8"
				type="date"
				bind:value={nextDate}
				class="mt-1 w-full rounded-xl p-3 text-sm outline-none transition-all focus:ring-2"
				style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
			/>
		</div>

		<!-- Cuentas -->
		<div class="flex gap-2">
			<div class="flex-1">
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-9">
					{type === 'transfer' ? 'Desde' : 'Cuenta'}
				</label>
				<select id="a11y-9"
					bind:value={accountId}
					class="mt-1 w-full rounded-xl p-3 text-sm outline-none transition-all"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				>
					{#each financeStore.accounts as acc}
						<option value={acc.id}>{acc.name}</option>
					{/each}
				</select>
			</div>

			{#if type === 'transfer'}
				<div class="flex-1">
					<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-10">Hacia</label>
				<select id="a11y-10"
						bind:value={toAccountId}
						class="mt-1 w-full rounded-xl p-3 text-sm outline-none transition-all"
						style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
					>
						{#each financeStore.accounts.filter(a => a.id !== accountId) as acc}
							<option value={acc.id}>{acc.name}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>

		<!-- Categoria -->
		{#if type !== 'transfer'}
		<div>
			<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-11">Categoría</label>
				<select id="a11y-11"
				bind:value={categoryId}
				class="mt-1 w-full rounded-xl p-3 text-sm outline-none transition-all"
				style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
			>
				{#each financeStore.categories.filter(c => c.type === type) as cat}
					<option value={cat.id}>{cat.name}</option>
				{/each}
			</select>
		</div>
		{/if}

		<div>
			<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-12">Nota / Detalle</label>
				<input id="a11y-12"
				type="text"
				bind:value={note}
				placeholder="Ej. Suscripción a Netflix"
				class="mt-1 w-full rounded-xl p-3 text-sm outline-none transition-all focus:ring-2"
				style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
			/>
		</div>

		<button
			onclick={addRecurring}
			class="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-white shadow-md transition-all active:scale-95"
			style="background-color: var(--color-primary);"
		>
			<Repeat size={18} />
			<span>Guardar Recurrente</span>
		</button>
	</div>

	<!-- Lista -->
	<div class="space-y-3">
		{#each financeStore.recurringTransactions as rt}
			{@const category = financeStore.categories.find(c => c.id === rt.categoryId)}
			{@const account = financeStore.accounts.find(a => a.id === rt.accountId)}
			
			<div class="flex items-center justify-between rounded-2xl p-4 shadow-sm" style="background-color: var(--color-surface);">
				<div class="flex items-center gap-3">
					<div 
						class="flex h-10 w-10 items-center justify-center rounded-full text-white"
						style="background-color: {rt.type === 'expense' ? 'var(--color-danger)' : rt.type === 'income' ? 'var(--color-success)' : 'var(--color-primary)'};"
					>
						{#if rt.type === 'transfer'}
							🔄
						{:else}
							{category?.icon || '💰'}
						{/if}
					</div>
					<div>
						<div class="font-medium" style="color: var(--color-text);">
							{rt.note || (rt.type === 'transfer' ? 'Transferencia recurrente' : category?.name)}
						</div>
						<div class="text-xs" style="color: var(--color-text-secondary);">
							Próximo: {formatDate(rt.nextDate)} • {rt.frequency === 'daily' ? 'Diario' : rt.frequency === 'weekly' ? 'Semanal' : rt.frequency === 'biweekly' ? 'Quincenal' : 'Mensual'}
						</div>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<div class="text-right">
						<span class="font-bold" style="color: {rt.type === 'expense' ? 'var(--color-danger)' : rt.type === 'income' ? 'var(--color-success)' : 'var(--color-text)'};">
							{rt.type === 'expense' ? '-' : rt.type === 'income' ? '+' : ''}S/ {rt.amount.toFixed(2)}
						</span>
						<div class="text-xs opacity-70">{account?.name || 'Cuenta'}</div>
					</div>
					<button 
						onclick={() => deleteRecurring(rt.id)}
						class="p-1 rounded-full text-red-500 hover:bg-red-500/10 transition-colors"
					>
						<Trash2 size={16} />
					</button>
				</div>
			</div>
		{/each}

		{#if financeStore.recurringTransactions.length === 0}
			<div class="rounded-2xl p-8 text-center text-sm" style="background-color: var(--color-surface); color: var(--color-text-secondary);">
				No tienes transacciones recurrentes activas.
			</div>
		{/if}
	</div>
</div>
