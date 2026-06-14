<script lang="ts">
	import { themeStore, themes, type ThemeId } from '$lib/theme.svelte';
	import { Settings, X, DollarSign } from '@lucide/svelte';
	import { financeStore } from '$lib/store.svelte';
	import { vibrate } from '$lib/utils/haptics';

	let current = $derived(themeStore.current);

	function select(themeId: ThemeId) {
		vibrate(15);
		themeStore.setTheme(themeId);
	}
</script>

<!-- Selector de paletas -->
<div class="rounded-2xl p-5 shadow-sm mb-6" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
	<h2 class="mb-4 text-lg font-semibold" style="color: var(--color-text);">Apariencia y Tema</h2>
	
	<p class="mb-3 text-sm font-medium" style="color: var(--color-text-secondary);">Paleta de colores</p>
	<div class="flex flex-wrap gap-3 mb-6">
		{#each themes as theme}
			<button
				onclick={() => select(theme.id)}
				class="flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all active:scale-90"
				style="background-color: {current === theme.id ? 'var(--color-primary-bg)' : 'transparent'};"
			>
				<div
					class="h-10 w-10 rounded-full border-2 transition-transform"
					style="background-color: {theme.color}; border-color: {current === theme.id ? 'var(--color-primary)' : 'transparent'};"
				>
					{#if current === theme.id}
						<div class="flex h-full w-full items-center justify-center text-white text-lg">
							✓
						</div>
					{/if}
				</div>
				<span class="text-xs font-medium" style="color: var(--color-text);">
					{theme.icon} {theme.name}
				</span>
			</button>
		{/each}
	</div>

	<!-- Vista previa -->
	<div
		class="rounded-2xl p-4"
		style="background-color: var(--color-bg);"
	>
		<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-secondary);">Vista previa</p>
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-bold" style="background-color: var(--color-primary);">
				<DollarSign size={20} />
			</div>
			<div>
				<p class="text-sm font-medium" style="color: var(--color-text);">Gasto en almuerzo</p>
				<p class="text-xs" style="color: var(--color-text-secondary);">- {financeStore.formatCurrency(15.00)}</p>
			</div>
			<span class="ml-auto font-bold" style="color: var(--color-danger);">-{financeStore.formatCurrency(15.00)}</span>
		</div>
	</div>
</div>
