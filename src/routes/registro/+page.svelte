<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { vibrate } from '$lib/utils/haptics';
	import { goto } from '$app/navigation';
	import { TransactionSchema, type Category } from '$lib/schema';
	import { Mic, MicOff, Save, Plus, X } from '@lucide/svelte';
	import { parseSpeech } from '$lib/utils/speechParser';

	let amount = $state('');
	let categoryId = $state('1');
	let type = $state<'expense' | 'income' | 'transfer'>('expense');
	let accountId = $state(financeStore.accounts[0]?.id || 'default-cash');
	let toAccountId = $state(financeStore.accounts[1]?.id || 'default-cash');
	let toAmount = $state('');
	let note = $state('');
	let txDate = $state(new Date().toISOString().split('T')[0]); // YYYY-MM-DD, por defecto hoy
	let isRecording = $state(false);
	let dictationResult = $state('');

	// Categoría personalizada
	let showNewCategory = $state(false);
	let newCatName = $state('');


	const categories = financeStore.categories;

	function showToastMsg(msg: string, type: 'success' | 'error' | 'info' = 'success') {
		toastStore.add(msg, type);
	}

	function evaluateMath(expression: string): number | null {
		try {
			// Remove commas if they are followed by exactly 3 digits (thousand separator)
			let sanitized = expression.replace(/,(?=\d{3}(?!\d))/g, '');
			// Replace any remaining commas with dots (decimal separator)
			sanitized = sanitized.replace(/,/g, '.');
			// Remove anything else
			sanitized = sanitized.replace(/[^0-9+\-*/.]/g, '');
			
			if (!sanitized) return null;
			const result = new Function('return ' + sanitized)();
			return typeof result === 'number' ? result : null;
		} catch {
			return null;
		}
	}

	function handleAmountInput(e: any) {
		let val = e.target.value;
		// Si contiene operadores matemáticos o termina en punto/coma, no formatear en tiempo real para no interferir
		if (/[+\-*/]/.test(val) || val.endsWith('.') || val.endsWith(',')) {
			amount = val;
			return;
		}
		
		// Guardar si tiene decimales
		const parts = val.split(/[.,]/);
		if (parts.length > 2) {
			amount = val; // Invalid multiple dots, let user fix
			return;
		}

		// Limpiar todo excepto numeros
		let numeric = parts[0].replace(/\D/g, '');
		if (numeric) {
			numeric = parseInt(numeric, 10).toLocaleString('en-US'); // Agrega comas
		}
		
		if (parts.length === 2) {
			amount = numeric + '.' + parts[1].replace(/\D/g, '');
		} else {
			amount = numeric;
		}
	}

	function handleAmountBlur() {
		const val = evaluateMath(amount);
		if (val !== null && !isNaN(val)) {
			const parts = (Math.round(val * 100) / 100).toString().split('.');
			parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
			amount = parts.join('.');
		}
	}

	function saveTransaction() {
		const finalAmount = evaluateMath(amount);

		if (finalAmount === null || isNaN(finalAmount) || finalAmount <= 0) {
			showToastMsg('Ingresa un monto válido', 'error');
			return;
		}

		// Construir ISO desde la fecha elegida preservando la hora local del dispositivo
		const [year, month, day] = txDate.split('-').map(Number);
		const chosenDate = new Date(year, month - 1, day, new Date().getHours(), new Date().getMinutes());

		const newTx = {
			id: crypto.randomUUID(),
			date: chosenDate.toISOString(),
			amount: finalAmount,
			categoryId: type === 'transfer' ? 'transfer' : categoryId,
			accountId,
			toAccountId: type === 'transfer' ? toAccountId : undefined,
			toAmount: type === 'transfer' && toAmount ? evaluateMath(toAmount) ?? undefined : undefined,
			note,
			type
		};

		const parsed = TransactionSchema.safeParse(newTx);
		if (!parsed.success) {
			toastStore.add('Error en los datos: Revisa el formulario', 'error');
			return;
		}

		financeStore.addTransaction(parsed.data);
		
		vibrate(15);
		
		if (parsed.data.type === 'expense' && parsed.data.categoryId !== 'transfer') {
			const progress = financeStore.getBudgetProgress(parsed.data.categoryId);
			if (progress) {
				if (progress.percent >= 100) {
					toastStore.add(`¡Has superado el presupuesto! (${progress.percent}%)`, 'error');
				} else if (progress.percent >= 80) {
					toastStore.add(`Cuidado, estás al ${progress.percent}% de tu presupuesto`, 'info');
				} else {
					toastStore.add('Transacción guardada', 'success');
				}
			} else {
				toastStore.add('Transacción guardada', 'success');
			}
		} else {
			toastStore.add('Transacción guardada', 'success');
		}

		goto('/');

		// Reset fields
		amount = '';
		note = '';
		dictationResult = '';
		txDate = new Date().toISOString().split('T')[0];
	}

	function addCustomCategory() {
		if (!newCatName.trim()) return;
		const newCat: Category = {
			id: crypto.randomUUID(),
			name: newCatName.trim(),
			icon: '🏷️',
			color: type === 'expense' ? 'bg-red-500' : 'bg-green-500',
			type: type as 'expense' | 'income'
		};
		if (!financeStore.addCategory(newCat)) return;
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
				<button
					class="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all active:scale-95"
					style="background-color: {type === 'transfer' ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-bg)'}; color: {type === 'transfer' ? 'var(--color-primary)' : 'var(--color-text-secondary)'};"
					onclick={() => { type = 'transfer'; }}
				>
					🔄 Transf.
				</button>
			</div>

			<!-- Monto -->
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-1">
					Monto (Moneda Base) <span class="font-normal opacity-70">(soporta sumas ej. 15+20)</span>
				</label>
				<input id="a11y-1"
					type="text"
					inputmode="decimal"
					value={amount}
					oninput={handleAmountInput}
					onblur={handleAmountBlur}
					placeholder="0.00"
					class="mt-1 w-full rounded-xl p-3.5 text-lg font-bold outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
			</div>

			<!-- Cuentas -->
			<div class="flex gap-2">
				<div class="flex-1">
					<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-2">
						{type === 'transfer' ? 'Desde Cuenta' : 'Cuenta'}
					</label>
				<select id="a11y-2"
						bind:value={accountId}
						class="mt-1 w-full rounded-xl p-3.5 text-sm outline-none transition-all focus:ring-2"
						style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
					>
						{#each financeStore.accounts as acc}
							<option value={acc.id}>{acc.name} ({financeStore.formatCurrency(acc.balance)})</option>
						{/each}
					</select>
				</div>

				{#if type === 'transfer'}
					<div class="flex-1">
						<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-3">Hacia Cuenta</label>
				<select id="a11y-3"
							bind:value={toAccountId}
							class="mt-1 w-full rounded-xl p-3.5 text-sm outline-none transition-all focus:ring-2"
							style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
						>
							{#each financeStore.accounts.filter(a => a.id !== accountId) as acc}
								<option value={acc.id}>{acc.name} ({financeStore.formatCurrency(acc.balance)})</option>
							{/each}
						</select>
					</div>
				{/if}
				{#if type === 'transfer' && financeStore.accounts.find((account) => account.id === accountId)?.currency !== financeStore.accounts.find((account) => account.id === toAccountId)?.currency}
					<div>
						<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="transfer-destination-amount">Monto que recibe la cuenta destino (opcional)</label>
						<input id="transfer-destination-amount" type="number" min="0.01" step="0.01" bind:value={toAmount} placeholder="Se calcula con la tasa configurada" class="mt-1 w-full rounded-xl p-3.5 text-sm outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" />
					</div>
				{/if}
			</div>

			<!-- Categoria -->
			{#if type !== 'transfer'}
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-4">Categoría</label>
				<div class="mt-1 flex gap-2">
					<select
						id="transaction-category"
						bind:value={categoryId}
						class="flex-1 rounded-xl p-3.5 text-sm outline-none transition-all focus:ring-2"
						style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
					>
						{#each categories.filter(c => !c.id.startsWith('__') && c.type === type) as cat}
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
						{#if categories.filter(c => c.type === type && !c.id.startsWith('__') && c.id.length > 5).length > 0}
							<div class="mt-4 border-t pt-3" style="border-color: var(--color-border);">
								<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-secondary);">Tus Categorías Personalizadas</p>
								<div class="flex flex-wrap gap-2">
									{#each categories.filter(c => c.type === type && !c.id.startsWith('__') && c.id.length > 5) as cat}
										<div class="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
											<span style="color: var(--color-text);">{cat.name}</span>
											<button 
												onclick={() => {
												const success = financeStore.deleteCategory(cat.id);
												if (success) {
													vibrate([10, 30, 10]);
													toastStore.add('Categoría eliminada', 'error');
												}
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
			{/if}

			<!-- Nota -->
			<div>
				<label for="transaction-note" class="block text-xs font-medium" style="color: var(--color-text-secondary);">Nota / Detalle</label>
				<input id="transaction-note"
					type="text"
					bind:value={note}
					placeholder="Ej. Almuerzo con amigos"
					class="mt-1 w-full rounded-xl p-3.5 text-sm outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
				/>
			</div>

			<!-- Fecha -->
			<div>
				<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="a11y-5">Fecha</label>
				<input id="a11y-5"
					type="date"
					bind:value={txDate}
					max={new Date().toISOString().split('T')[0]}
					class="mt-1 w-full rounded-xl p-3.5 text-sm outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border); color-scheme: {document?.documentElement?.classList?.contains('dark') ? 'dark' : 'light'};"
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
