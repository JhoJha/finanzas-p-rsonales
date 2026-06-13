<script lang="ts">
	export type Period = 'all' | 'today' | 'week' | 'month' | 'year';

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

	function handleChange(period: Period) {
		selected = period;
		onChange(period);
	}
</script>

<div class="flex flex-wrap gap-2">
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
</div>
