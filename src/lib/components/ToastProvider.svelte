<script lang="ts">
	import { toastStore } from '$lib/toast.svelte';
	import { CheckCircle2, AlertCircle, Info, TriangleAlert } from '@lucide/svelte';
</script>

<div class="pointer-events-none fixed left-0 right-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
	{#each toastStore.toasts as toast (toast.id)}
		<div
			class="animate-toast-in flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-md"
			style="
				background-color: {toast.type === 'success' ? 'rgba(22, 163, 74, 0.95)' : toast.type === 'error' ? 'rgba(220, 38, 38, 0.95)' : toast.type === 'warning' ? 'rgba(217, 119, 6, 0.95)' : 'rgba(59, 130, 246, 0.95)'};
				color: white;
				border: 1px solid rgba(255,255,255,0.1);
			"
		>
			{#if toast.type === 'success'}
				<CheckCircle2 size={16} />
			{:else if toast.type === 'error'}
				<AlertCircle size={16} />
			{:else if toast.type === 'warning'}
				<TriangleAlert size={16} />
			{:else}
				<Info size={16} />
			{/if}
			{toast.message}
		</div>
	{/each}
</div>
