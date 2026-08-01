<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { createPinSecurity, verifyPin } from '$lib/utils/security';
	import { ArrowLeft, LockKeyhole, ShieldCheck } from '@lucide/svelte';

	let pin = $state('');
	let confirmPin = $state('');
	let currentPin = $state('');
	let isSaving = $state(false);
	let isProtected = $derived(Boolean(financeStore.settings.security));

	async function enablePin() {
		if (!/^\d{4,8}$/.test(pin) || pin !== confirmPin) {
			toastStore.add('Usa un PIN numérico de 4 a 8 dígitos y confírmalo.', 'error');
			return;
		}
		isSaving = true;
		try {
			financeStore.updateSettings({ security: await createPinSecurity(pin) });
			sessionStorage.setItem('finances_unlocked', '1');
			pin = '';
			confirmPin = '';
			toastStore.add('Bloqueo con PIN activado.', 'success');
		} catch {
			toastStore.add('Tu navegador no pudo activar el bloqueo.', 'error');
		} finally { isSaving = false; }
	}

	async function disablePin() {
		const security = financeStore.settings.security;
		if (!security || !(await verifyPin(currentPin, security))) {
			toastStore.add('PIN incorrecto.', 'error');
			return;
		}
		financeStore.updateSettings({ security: undefined });
		currentPin = '';
		toastStore.add('Bloqueo con PIN desactivado.', 'info');
	}
</script>

<div class="animate-fade-in-up space-y-6">
	<div class="flex items-center gap-3"><a href="/ajustes" aria-label="Volver a ajustes" class="rounded-full p-2 hover:bg-black/5" style="color: var(--color-text);"><ArrowLeft size={24} /></a><h1 class="text-2xl font-bold" style="color: var(--color-text);">Privacidad</h1></div>
	<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
		<div class="mb-4 flex items-center gap-3"><div class="rounded-xl p-3" style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary);"><LockKeyhole size={22} /></div><div><h2 class="font-semibold" style="color: var(--color-text);">Bloqueo local con PIN</h2><p class="text-xs" style="color: var(--color-text-secondary);">Se solicitará al abrir de nuevo la aplicación.</p></div></div>
		{#if !isProtected}
			<div class="space-y-3">
				<div><label for="security-pin" class="block text-xs font-medium" style="color: var(--color-text-secondary);">Nuevo PIN</label><input id="security-pin" type="password" inputmode="numeric" maxlength="8" bind:value={pin} class="mt-1 w-full rounded-xl p-3 outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" /></div>
				<div><label for="security-confirm-pin" class="block text-xs font-medium" style="color: var(--color-text-secondary);">Confirmar PIN</label><input id="security-confirm-pin" type="password" inputmode="numeric" maxlength="8" bind:value={confirmPin} class="mt-1 w-full rounded-xl p-3 outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" /></div>
				<button onclick={enablePin} disabled={isSaving} class="w-full rounded-xl py-3 font-bold text-white disabled:opacity-60" style="background-color: var(--color-primary);">Activar bloqueo</button>
			</div>
		{:else}
			<div class="space-y-3"><p class="flex items-center gap-2 text-sm" style="color: var(--color-success);"><ShieldCheck size={18} /> El bloqueo con PIN está activo.</p><div><label for="security-current-pin" class="block text-xs font-medium" style="color: var(--color-text-secondary);">PIN actual</label><input id="security-current-pin" type="password" inputmode="numeric" maxlength="8" bind:value={currentPin} class="mt-1 w-full rounded-xl p-3 outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" /></div><button onclick={disablePin} class="w-full rounded-xl py-3 font-semibold" style="background-color: color-mix(in srgb, var(--color-danger) 12%, transparent); color: var(--color-danger);">Desactivar bloqueo</button></div>
		{/if}
	</div>
</div>
