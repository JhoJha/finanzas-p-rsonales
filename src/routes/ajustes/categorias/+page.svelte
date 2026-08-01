<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { ArrowLeft, Plus, Trash2 } from '@lucide/svelte';

	let categories = $derived(financeStore.categories.filter(c => !c.id.startsWith('__')));
	
	let showForm = $state(false);
	let newName = $state('');
	let newType = $state<'income'|'expense'>('expense');
	let newIcon = $state('tag');
	let newColor = $state('bg-blue-500');

	const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-gray-500'];

	function saveCategory() {
		if (!newName.trim()) {
			toastStore.add('El nombre es requerido', 'error');
			return;
		}
		
		// Access CategoriesStore directly if we don't have a facade method
		// Let's check if there is an addCategory in financeStore... 
		// Actually I added it previously? Let's check!
		financeStore.addCategory({
			id: crypto.randomUUID(),
			name: newName.trim(),
			type: newType,
			icon: newIcon,
			color: newColor
		});
		
		toastStore.add('Categoría creada', 'success');
		showForm = false;
		newName = '';
	}

	function deleteCategory(id: string) {
		const isUsed = financeStore.transactions.some(t => t.categoryId === id);
		if (isUsed) {
			toastStore.add('No puedes eliminar una categoría en uso', 'error');
			return;
		}
		if (confirm('¿Eliminar esta categoría?')) {
			const deleted = financeStore.deleteCategory(id);
			if (!deleted) return;
			toastStore.add('Categoría eliminada', 'success');
		}
	}
</script>

<div class="animate-fade-in-up space-y-6">
	<div class="flex items-center gap-3">
		<a href="/ajustes" class="rounded-full p-2 hover:bg-black/5" style="color: var(--color-text);">
			<ArrowLeft size={24} />
		</a>
		<h1 class="text-2xl font-bold" style="color: var(--color-text);">Categorías</h1>
	</div>

	<div class="space-y-3">
		{#each categories as cat}
			<div class="flex items-center justify-between rounded-xl p-3 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
				<div class="flex items-center gap-3">
					<div class="flex h-8 w-8 items-center justify-center rounded-full {cat.color} text-white text-xs">
						{cat.icon[0].toUpperCase()}
					</div>
					<div>
						<p class="text-sm font-semibold" style="color: var(--color-text);">{cat.name}</p>
						<p class="text-xs" style="color: var(--color-text-secondary);">{cat.type === 'income' ? 'Ingreso' : 'Gasto'}</p>
					</div>
				</div>
				<button onclick={() => deleteCategory(cat.id)} class="text-red-500 hover:opacity-80">
					<Trash2 size={16} />
				</button>
			</div>
		{/each}
	</div>

	{#if showForm}
		<div class="animate-fade-in-up rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
			<h2 class="mb-4 font-semibold" style="color: var(--color-text);">Nueva Categoría</h2>
			<div class="space-y-3">
				<div>
					<label for="category-name" class="mb-1 block text-xs" style="color: var(--color-text-secondary);">Nombre</label>
					<input id="category-name" type="text" bind:value={newName} class="w-full rounded-xl p-2 outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" />
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="category-type" class="mb-1 block text-xs" style="color: var(--color-text-secondary);">Tipo</label>
						<select id="category-type" bind:value={newType} class="w-full rounded-xl p-2 outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);">
							<option value="expense">Gasto</option>
							<option value="income">Ingreso</option>
						</select>
					</div>
					<div>
						<label for="category-icon" class="mb-1 block text-xs" style="color: var(--color-text-secondary);">Icono (texto corto)</label>
						<input id="category-icon" type="text" bind:value={newIcon} placeholder="ej. tag, star" class="w-full rounded-xl p-2 outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" />
					</div>
				</div>
				<fieldset>
					<legend class="mb-1 block text-xs" style="color: var(--color-text-secondary);">Color</legend>
					<div class="flex gap-2">
						{#each colors as c}
							<button type="button" onclick={() => newColor = c} aria-label={`Seleccionar color ${c.replace('bg-', '')}`} class="h-6 w-6 rounded-full {c} {newColor === c ? 'ring-2 ring-offset-2' : ''}"></button>
						{/each}
					</div>
				</fieldset>
				<div class="mt-4 flex gap-2">
					<button onclick={() => (showForm = false)} class="flex-1 rounded-xl py-2 font-semibold" style="background-color: var(--color-bg); color: var(--color-text);">Cancelar</button>
					<button onclick={saveCategory} class="flex-1 rounded-xl py-2 font-semibold text-white" style="background-color: var(--color-primary);">Guardar</button>
				</div>
			</div>
		</div>
	{:else}
		<button
			onclick={() => (showForm = true)}
			class="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold transition-all active:scale-95"
			style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary);"
		>
			<Plus size={20} /> Añadir Categoría
		</button>
	{/if}
</div>
