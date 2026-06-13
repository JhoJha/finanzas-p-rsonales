<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { vibrate } from '$lib/utils/haptics';
	import { goto } from '$app/navigation';
	import type { Transaction, Category } from '$lib/schema';
	import { Mic, MicOff, Save, Plus, X } from '@lucide/svelte';
	import { parseSpeech } from '$lib/utils/speechParser';
	import Toast from '$lib/components/Toast.svelte';

	let amount = $state('');
	let categoryId = $state('1');
	let type = $state<'expense' | 'income'>('expense');
	let note = $state('');
	let isRecording = $state(false);
	let dictationResult = $state('');
	let toastMessage = $state('');
	let toastType = $state<'success' | 'error' | 'info'>('success');
	let showToast = $state(false);

	// Nueva categoría personalizada
	let showNewCategory = $state(false);
	let newCatName = $state('');

	const categories = financeStore.categories;

	function showToastMsg(msg: string, type: 'success' | 'error' | 'info' = 'success') {
		toastMessage = msg;
		toastType = type;
		showToast = true;
	}

	function saveTransaction() {
		if (!amount || isNaN(parseFloat(amount))) {
			showToastMsg('Ingresa un monto válido', 'error');
			return;
		}

		const newTx: Transaction = {
			id: crypto.randomUUID(),
			date: new Date().toISOString(),
			amount: parseFloat(amount),
			categoryId,
			note,
			type
		};
		financeStore.addTransaction(newTx);
		
		vibrate(15);
		toastStore.add('Transacción guardada exitosamente', 'success');
		goto('/');

		// Reset fields
		amount = '';
		note = '';
		dictationResult = '';
	}

	function addCustomCategory() {
		if (!newCatName.trim()) return;
		const newCat: Category = {
			id: crypto.randomUUID(),
			name: newCatName.trim(),
			icon: '🏷️',
			color: type === 'expense' ? 'bg-red-500' : 'bg-green-500',
			type
		};
		financeStore.categories.push(newCat);
		vibrate(10);
		toastStore.add('Categoría creada', 'success');
		categoryId = newCat.id;
		newCatName = '';
		showNewCategory = false;
	}

	function startRecording() {
		if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
			showToastMsg('Tu navegador no soporta voz', 'error');
			return;
		}

		isRecording = true;
		dictationResult = '🎙️ Escuchando...';
		const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
		const recognition = new SpeechRecognition();

		recognition.lang = 'es-ES';
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;

		recognition.onresult = (event: any) => {
			const transcript = event.results[0][0].transcript;
			dictationResult = `✓ "${transcript}"`;

			const parsed = parseSpeech(transcript);
			if (parsed.amount) amount = parsed.amount.toString();
			categoryId = parsed.categoryId;
			type = parsed.type;
			note = transcript;
			
			vibrate(15);
			toastStore.add('Voz procesada', 'info');
		};

		recognition.onerror = () => {
			isRecording = false;
			dictationResult = '❌ Error al escuchar';
		};

		recognition.onend = () => {
			isRecording = false;
		};

		recognition.start();
	}
</script>

<Toast message={toastMessage} type={toastType} visible={showToast} />

<div class="animate-fade-in-up space-y-5">
	<h1 class="text-2xl font-bold" style="color: var(--color-text);">Registro Rápido</h1>

	<!-- Voice UI -->
	<div class="rounded-2xl p-6 text-center shadow-sm" style="background-color: var(--color-surface);">
		<p class="mb-4 text-sm" style="color: var(--color-text-secondary);">
			Presiona para dictar <br />
			<span class="font-medium" style="color: var(--color-text);">"Gasté 15 soles en almuerzo"</span>
		</p>
		<button
			onclick={startRecording}
			class="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-90"
			style="background-color: {isRecording ? 'var(--color-danger)' : 'var(--color-primary)'};"
			class:animate-pulse={isRecording}
		>
			{#if isRecording}
				<MicOff size={32} />
			{:else}
				<Mic size={32} />
			{/if}
		</button>

		{#if dictationResult}
			<p class="mt-4 animate-fade-in-up text-sm font-medium" style="color: var(--color-primary);">
				{dictationResult}
			</p>
		{/if}
	</div>

	<!-- Form UI -->
	<div class="rounded-2xl p-6 shadow-sm" style="background-color: var(--color-surface);">
		<h2 class="mb-4 border-b pb-2 text-lg font-semibold" style="color: var(--color-text); border-color: var(--color-border);">
			O ingresa manualmente
		</h2>

		<div class="space-y-4">
			<!-- Tipo -->
			<div class="flex gap-2">
				<button
					class="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all active:scale-95"
					style="background-color: {type === 'expense' ? 'color-mix(in srgb, var(--color-danger) 15%, transparent)' : 'var(--color-bg)'}; color: {type === 'expense' ? 'var(--color-danger)' : 'var(--color-text-secondary)'};"
					onclick={() => { type = 'expense'; categoryId = categories.filter(c => c.type === 'expense')[0]?.id || '1'; }}
				>
					💸 Gasto
				</button>
				<button
					class="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all active:scale-95"
					style="background-color: {type === 'income' ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : 'var(--color-bg)'}; color: {type === 'income' ? 'var(--color-success)' : 'var(--color-text-secondary)'};"
					onclick={() => { type = 'income'; categoryId = categories.filter(c => c.type === 'income')[0]?.id || '6'; }}
				>
					💰 Ingreso
				</button>
			</div>

			<!-- Monto -->
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);">Monto (S/)</label>
				<input
					type="number"
					bind:value={amount}
					placeholder="0.00"
					class="mt-1 w-full rounded-xl p-3.5 text-lg font-bold outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
			</div>

			<!-- Categoria -->
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);">Categoría</label>
				<div class="mt-1 flex gap-2">
					<select
						bind:value={categoryId}
						class="flex-1 rounded-xl p-3.5 text-sm outline-none transition-all focus:ring-2"
						style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
					>
						{#each categories.filter(c => c.type === type) as cat}
							<option value={cat.id}>{cat.name}</option>
						{/each}
					</select>
					<button
						onclick={() => (showNewCategory = !showNewCategory)}
						class="flex h-[48px] w-[48px] flex-shrink-0 items-center justify-center rounded-xl transition-all active:scale-90"
						style="background-color: var(--color-bg); color: var(--color-primary); border: 1px solid var(--color-border);"
					>
						<Plus size={20} />
					</button>
				</div>

				{#if showNewCategory}
					<div class="mt-2 animate-slide-down rounded-xl p-4" style="background-color: var(--color-bg); border: 1px solid var(--color-border);">
						<div class="mb-3 flex gap-2">
							<input
								type="text"
								bind:value={newCatName}
								placeholder="Nombre de la categoría"
								class="flex-1 rounded-xl p-3 text-sm outline-none"
								style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);"
							/>
							<button
								onclick={addCustomCategory}
								class="rounded-xl px-4 text-sm font-semibold text-white transition-all active:scale-90"
								style="background-color: var(--color-primary);"
							>
								Crear
							</button>
						</div>

						<!-- Categorías personalizadas -->
						{#if categories.filter(c => c.type === type && c.id.length > 5).length > 0}
							<div class="mt-4 border-t pt-3" style="border-color: var(--color-border);">
								<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-secondary);">Tus Categorías Personalizadas</p>
								<div class="flex flex-wrap gap-2">
									{#each categories.filter(c => c.type === type && c.id.length > 5) as cat}
										<div class="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
											<span style="color: var(--color-text);">{cat.name}</span>
											<button 
												onclick={() => {
													financeStore.deleteCategory(cat.id);
													vibrate([10, 30, 10]);
													toastStore.add('Categoría eliminada', 'error');
												}}
												class="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-red-500 hover:bg-red-100 transition-colors"
												aria-label="Eliminar categoría"
											>
												<X size={12} />
											</button>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Nota -->
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);">Nota / Detalle</label>
				<input
					type="text"
					bind:value={note}
					placeholder="Ej. Almuerzo con amigos"
					class="mt-1 w-full rounded-xl p-3.5 text-sm outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
			</div>

			<!-- Submit -->
			<button
				onclick={saveTransaction}
				class="flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold text-white shadow-lg transition-all active:scale-95"
				style="background-color: var(--color-primary);"
			>
				<Save size={20} />
				<span>Guardar</span>
			</button>
		</div>
	</div>
</div>