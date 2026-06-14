<script lang="ts">
	import type { Period } from '$lib/store.svelte';

	let {
		selected = 'all' as Period,
		onChange = (_p: Period) => {}
	} = $props();

	const periods: { id: Period; label: string }[] = [
		{ id: 'all', label: 'Todo' },
		{ id: 'today', label: 'Hoy' },
		{ id: 'week', label: '7 días' },
		{ id: 'month', label: '30 días' },
		{ id: 'year', label: 'Este año' }
	];

	let customMonth = $state('');

	function handleChange(period: Period) {
		selected = period;
		onChange(period);
	}

	function handleCustomMonth(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		if (val) {
			handleChange(val);
		}
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	{#each periods as p}
		<button
			onclick={() => handleChange(p.id)}
			class="rounded-full px-4 py-1.5 text-xs font-semibold transition-all active:scale-95"
			style="
				background-color: {selected === p.id ? 'var(--color-primary)' : 'var(--color-bg)'};
				color: {selected === p.id ? 'white' : 'var(--color-text-secondary)'};
			"
		>
			{p.label}
		</button>
	{/each}
	
	<input 
		type="month" 
		bind:value={customMonth}
		onchange={handleCustomMonth}
		class="rounded-full px-3 py-1.5 text-xs font-semibold outline-none transition-all cursor-pointer"
		style="
			background-color: {typeof selected === 'string' && selected.includes('-') ? 'var(--color-primary)' : 'var(--color-bg)'};
			color: {typeof selected === 'string' && selected.includes('-') ? 'white' : 'var(--color-text-secondary)'};
			border: 1px solid var(--color-border);
		"
	/>
</div>
