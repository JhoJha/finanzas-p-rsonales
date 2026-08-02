<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { categoryDisplayName } from '$lib/i18n';
	import { ArrowLeft, Trash2 } from '@lucide/svelte';

	let phrase = $state('');
	let type = $state<'expense' | 'income'>('expense');
	let categoryId = $state('1');
	let categories = $derived(financeStore.categories.filter((category) => category.type === type && !category.id.startsWith('__')));

	function saveRule() {
		if (financeStore.learnClassificationRule(phrase, categoryId, type, financeStore.settings.locale, true)) phrase = '';
	}
</script>

<div class="animate-fade-in-up space-y-5">
	<div class="flex items-center gap-3"><a href="/ajustes" class="rounded-full p-2" style="color: var(--color-text);"><ArrowLeft size={22} /></a><div><h1 class="text-2xl font-bold" style="color: var(--color-text);">Reglas aprendidas</h1><p class="text-xs" style="color: var(--color-text-secondary);">Solo se guardan en este dispositivo.</p></div></div>
	<section class="rounded-2xl p-4" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
		<label for="rule-phrase" class="text-xs" style="color: var(--color-text-secondary);">Palabra, comercio o detalle</label><input id="rule-phrase" bind:value={phrase} placeholder="Ej. Cuates" class="mt-1 w-full rounded-xl p-3" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" />
		<div class="mt-3 grid grid-cols-2 gap-2"><select bind:value={type} onchange={() => categoryId = categories[0]?.id || ''} class="rounded-xl p-3" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"><option value="expense">Gasto</option><option value="income">Ingreso</option></select><select bind:value={categoryId} class="rounded-xl p-3" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);">{#each categories as category}<option value={category.id}>{categoryDisplayName(category, financeStore.settings.locale)}</option>{/each}</select></div>
		<button onclick={saveRule} class="mt-3 w-full rounded-xl py-3 font-bold text-white" style="background-color: var(--color-primary);">Guardar regla</button>
	</section>
	<section class="space-y-2">{#if financeStore.settings.classificationRules.length}{#each financeStore.settings.classificationRules as rule (rule.id)}<div class="flex items-center justify-between rounded-xl p-3" style="background-color: var(--color-surface); border: 1px solid var(--color-border);"><div><p class="font-semibold" style="color: var(--color-text);">{rule.phrase}</p><p class="text-xs" style="color: var(--color-text-secondary);">{categoryDisplayName(financeStore.categories.find((category) => category.id === rule.categoryId), financeStore.settings.locale)} · confianza {rule.confidence}/10</p></div><button onclick={() => financeStore.removeClassificationRule(rule.id)} aria-label="Eliminar regla" style="color: var(--color-danger);"><Trash2 size={18} /></button></div>{/each}{:else}<p class="rounded-xl p-4 text-sm" style="background-color: var(--color-surface); color: var(--color-text-secondary);">Aún no hay reglas personales.</p>{/if}</section>
</div>
