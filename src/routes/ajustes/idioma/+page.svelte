<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { ArrowLeft, Languages, Save } from '@lucide/svelte';
	import { SUPPORTED_LOCALES, TIME_ZONE_OPTIONS, categoryDisplayName, resolveLocale } from '$lib/i18n';
	import { REGIONAL_PACKS, REGIONAL_PACK_IDS, type RegionalPackId } from '$lib/domain/regional-packs';

	let locale = $state(financeStore.settings.locale);
	let timeZone = $state(financeStore.settings.timeZone);
	let regionalPacks = $state<RegionalPackId[]>(financeStore.settings.regionalPacks);

	function savePreferences() {
		if (!financeStore.updateSettings({ locale: resolveLocale(locale), timeZone, regionalPacks })) return;
		toastStore.add('Idioma y zona horaria guardados.', 'success');
	}
</script>

<div class="animate-fade-in-up space-y-6">
	<div class="flex items-center gap-3">
		<a href="/ajustes" class="rounded-full p-2 hover:bg-black/5" style="color: var(--color-text);"><ArrowLeft size={24} /></a>
		<div><h1 class="text-2xl font-bold" style="color: var(--color-text);">Idioma y región</h1><p class="text-sm" style="color: var(--color-text-secondary);">Controla cómo se presentan tus datos; no modifica tus movimientos.</p></div>
	</div>

	<div class="rounded-2xl p-5 shadow-sm space-y-5" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
		<div>
			<label for="locale" class="mb-1 block text-sm font-semibold" style="color: var(--color-text);">Idioma</label>
			<select id="locale" bind:value={locale} class="w-full rounded-xl p-3 outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);">
				{#each SUPPORTED_LOCALES as option}<option value={option}>{option === 'es-PE' ? 'Español (Perú)' : 'English (United States)'}</option>{/each}
			</select>
		</div>

		<div>
			<p class="mb-2 text-sm font-semibold" style="color: var(--color-text);">Paquetes regionales del parser</p>
			<p class="mb-2 text-xs" style="color: var(--color-text-secondary);">Añaden expresiones locales; las reglas personales siempre tienen prioridad.</p>
			<div class="grid grid-cols-2 gap-2">{#each REGIONAL_PACK_IDS as pack}<label class="flex items-center gap-2 rounded-lg p-2 text-sm" style="background-color: var(--color-bg); color: var(--color-text);"><input type="checkbox" checked={regionalPacks.includes(pack)} onchange={(event) => regionalPacks = (event.currentTarget as HTMLInputElement).checked ? [...regionalPacks, pack] : regionalPacks.filter((item) => item !== pack)} />{REGIONAL_PACKS[pack].label}</label>{/each}</div>
		</div>

		<div>
			<label for="time-zone" class="mb-1 block text-sm font-semibold" style="color: var(--color-text);">Zona horaria</label>
			<select id="time-zone" bind:value={timeZone} class="w-full rounded-xl p-3 outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);">
				{#each TIME_ZONE_OPTIONS as option}<option value={option.value}>{option.label}</option>{/each}
			</select>
		</div>

		<div class="rounded-xl p-4 text-sm" style="background-color: var(--color-bg); color: var(--color-text-secondary);">
			<div class="mb-2 flex items-center gap-2 font-semibold" style="color: var(--color-text);"><Languages size={16} /> Vista previa</div>
			<p>{categoryDisplayName(financeStore.categories.find((category) => category.code === 'food'), locale)}</p>
			<p class="mt-1">{financeStore.formatCurrency(1234.5)}</p>
		</div>

		<button onclick={savePreferences} class="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white" style="background-color: var(--color-primary);"><Save size={18} /> Guardar preferencias</button>
	</div>
</div>
