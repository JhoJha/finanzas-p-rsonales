<script lang="ts">
	import { themeStore, themes, type ThemeId } from '$lib/theme.svelte';
	import { Settings, X } from '@lucide/svelte';

	let open = $state(false);
	let current = $derived(themeStore.current);

	function select(themeId: ThemeId) {
		themeStore.setTheme(themeId);
	}
</script>

<!-- Botón flotante de configuración -->
<button
	onclick={() => (open = true)}
	class="fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white shadow-lg backdrop-blur-sm transition-transform active:scale-90 hover:bg-white/30"
	aria-label="Configurar tema"
>
	<Settings size={18} />
</button>

<!-- Panel de temas -->
{#if open}
	<!-- Overlay -->
	<div
		class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
		onclick={() => (open = false)}
		role="presentation"
	></div>

	<!-- Panel -->
	<div
		class="fixed bottom-0 left-0 right-0 z-50 animate-slide-down rounded-t-3xl px-6 pb-10 pt-6 shadow-2xl"
		style="background-color: var(--color-surface); color: var(--color-text);"
	>
		<div class="mb-6 flex items-center justify-between">
			<h2 class="text-lg font-bold">Personalizar tema</h2>
			<button
				onclick={() => (open = false)}
				class="flex h-8 w-8 items-center justify-center rounded-full"
				style="background-color: var(--color-bg);"
			>
				<X size={18} />
			</button>
		</div>

		<!-- Selector de paletas -->
		<div class="mb-6">
			<p class="mb-3 text-sm font-medium" style="color: var(--color-text-secondary);">Paleta de colores</p>
			<div class="flex flex-wrap gap-3">
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
		</div>

		<!-- Vista previa -->
		<div
			class="rounded-2xl p-4"
			style="background-color: var(--color-bg);"
		>
			<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-secondary);">Vista previa</p>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-bold" style="background-color: var(--color-primary);">
					S/
				</div>
				<div>
					<p class="text-sm font-medium" style="color: var(--color-text);">Gasto en almuerzo</p>
					<p class="text-xs" style="color: var(--color-text-secondary);">- S/ 15.00</p>
				</div>
				<span class="ml-auto font-bold" style="color: var(--color-danger);">-S/15.00</span>
			</div>
		</div>
	</div>
{/if}
