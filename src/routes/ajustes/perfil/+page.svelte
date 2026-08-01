<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { vibrate } from '$lib/utils/haptics';
	import { Save, User, Camera, ArrowLeft } from '@lucide/svelte';
	import { goto } from '$app/navigation';

	let profile = $state({
		name: financeStore.settings.profile?.name ?? '',
		avatar: financeStore.settings.profile?.avatar ?? '👋',
		usePhoto: financeStore.settings.profile?.usePhoto ?? false
	});
	let fileInput: HTMLInputElement;

	function saveProfile() {
		financeStore.updateSettings({ profile });
		vibrate(20);
		toastStore.add('Perfil guardado exitosamente', 'success');
		goto('/ajustes');
	}

	async function handlePhotoUpload(e: any) {
		const file = e.target.files?.[0];
		if (!file) return;

		// Convert to Base64
		const reader = new FileReader();
		reader.onload = (event) => {
			if (event.target?.result) {
				profile.avatar = event.target.result as string;
				profile.usePhoto = true;
			}
		};
		reader.readAsDataURL(file);
	}
</script>

<div class="animate-fade-in-up space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<button
			onclick={() => history.back()}
			aria-label="Volver"
			class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-text transition-colors hover:bg-white/20"
		>
			<ArrowLeft size={20} />
		</button>
		<h1 class="text-2xl font-bold" style="color: var(--color-text);">Mi Perfil</h1>
	</div>

	<div class="rounded-2xl p-6 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
		<div class="mb-6 flex flex-col items-center">
			<!-- Avatar Preview -->
			<div class="relative mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 shadow-inner overflow-hidden text-4xl" style="border: 2px solid var(--color-primary);">
				{#if profile.usePhoto && profile.avatar.length > 10}
					<img src={profile.avatar} alt="Avatar" class="h-full w-full object-cover" />
				{:else}
					{profile.avatar || '👋'}
				{/if}

				<button
					onclick={() => fileInput.click()}
					aria-label="Subir foto de perfil"
					class="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-md hover:scale-105 active:scale-95"
				>
					<Camera size={14} />
				</button>
				<input type="file" accept="image/*" bind:this={fileInput} onchange={handlePhotoUpload} class="hidden" />
			</div>

			<p class="text-xs text-center mb-2" style="color: var(--color-text-secondary);">
				Selecciona un emoji abajo o sube una foto con el ícono de cámara.
			</p>
			
			{#if profile.usePhoto}
				<button
					onclick={() => { profile.usePhoto = false; profile.avatar = '👋'; }}
					class="text-xs text-red-500 underline mb-4"
				>
					Quitar foto y usar Emoji
				</button>
			{:else}
				<div class="flex flex-wrap justify-center gap-2 mb-4">
					{#each ['👋','👨‍💻','👩‍💼','🦊','🤖','😎','🚀','🌟','💎'] as emoji}
						<button
							onclick={() => { profile.avatar = emoji; profile.usePhoto = false; vibrate(10); }}
							aria-label={`Usar emoji ${emoji}`}
							class="flex h-10 w-10 items-center justify-center rounded-full text-xl transition-all {profile.avatar === emoji ? 'bg-primary/20 scale-110' : 'bg-bg hover:bg-bg/80'}"
						>
							{emoji}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="space-y-4">
			<div>
				<label for="profile-name" class="mb-1 block text-sm font-medium" style="color: var(--color-text-secondary);">¿Cómo te llamas?</label>
				<input
					id="profile-name"
					type="text"
					bind:value={profile.name}
					placeholder="Ej. Juan, María..."
					class="w-full rounded-xl p-3 outline-none transition-all focus:ring-2 focus:ring-primary"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
			</div>

			<button
				onclick={saveProfile}
				class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-white shadow-lg transition-transform active:scale-95 bg-primary"
			>
				<Save size={20} />
				Guardar Perfil
			</button>
		</div>
	</div>
</div>
