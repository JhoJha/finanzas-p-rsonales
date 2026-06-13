<script lang="ts">
	import { CircleCheck, CircleAlert, Info, X } from '@lucide/svelte';

	type ToastType = 'success' | 'error' | 'info';

	let { message = '', type = 'success' as ToastType, visible = false } = $props();

	let isVisible = $state(false);
	let isLeaving = $state(false);

	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	// React to prop changes
	$effect(() => {
		if (visible) {
			show();
		}
	});

	function show() {
		if (timeoutId) clearTimeout(timeoutId);
		isLeaving = false;
		isVisible = true;

		timeoutId = setTimeout(() => {
			hide();
		}, 3000);
	}

	function hide() {
		isLeaving = true;
		setTimeout(() => {
			isVisible = false;
			isLeaving = false;
		}, 300);
	}

	const icons = {
		success: CircleCheck,
		error: CircleAlert,
		info: Info
	};

	const colors = {
		success: 'bg-green-600',
		error: 'bg-red-600',
		info: 'bg-blue-600'
	};
</script>

{#if isVisible}
	<div
		class="fixed bottom-28 left-4 right-4 z-[100] mx-auto max-w-md {isLeaving ? 'animate-toast-out' : 'animate-toast-in'}"
	>
		<div class="flex items-center gap-3 rounded-2xl px-5 py-4 shadow-2xl {colors[type]} text-white">
			{#each [icons[type]] as Icon}
				<Icon size={22} />
			{/each}
			<span class="flex-1 text-sm font-medium">{message}</span>
			<button onclick={hide} class="rounded-full p-1 hover:bg-white/20">
				<X size={16} />
			</button>
		</div>
	</div>
{/if}
