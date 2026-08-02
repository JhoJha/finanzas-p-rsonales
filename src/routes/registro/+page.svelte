<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { vibrate } from '$lib/utils/haptics';
	import { goto } from '$app/navigation';
	import { TransactionSchema, type Category, type Transaction } from '$lib/schema';
	import { Mic, MicOff, Save, Plus, X, Undo2 } from '@lucide/svelte';
	import { parseSpeechBatch, type SpeechTransactionDraft } from '$lib/utils/speechParser';
	import { categoryDisplayName } from '$lib/i18n';
	import { dateTimeFromDateOnly, todayInTimeZone } from '$lib/utils/date';

	let amount = $state('');
	let categoryId = $state('1');
	let type = $state<'expense' | 'income' | 'transfer'>('expense');
	let accountId = $state(financeStore.accounts[0]?.id || 'default-cash');
	let toAccountId = $state(financeStore.accounts[1]?.id || 'default-cash');
	let toAmount = $state('');
	let note = $state('');
	let txDate = $state(todayInTimeZone(financeStore.settings.timeZone)); // YYYY-MM-DD, por defecto hoy
	let isRecording = $state(false);
	let activeRecognition = $state<any>(null);
	let dictationResult = $state('');
	let transcript = $state('');
	let voiceDrafts = $state<SpeechTransactionDraft[]>([]);
	let voiceOperationId = $state<string | null>(null);
	let isConfirmingVoiceBatch = $state(false);
	let savedVoiceBatchCount = $state(0);
	let selectedAccount = $derived(financeStore.accounts.find((account) => account.id === accountId));
	let selectedDestinationAccount = $derived(financeStore.accounts.find((account) => account.id === toAccountId));
	let maxTransactionDate = $derived(todayInTimeZone(financeStore.settings.timeZone));

	// Categoría personalizada
	let showNewCategory = $state(false);
	let newCatName = $state('');


	let categories = $derived(financeStore.categories);

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

		const newTx = {
			id: crypto.randomUUID(),
			date: dateTimeFromDateOnly(txDate, financeStore.settings.timeZone),
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

		if (!financeStore.addTransaction(parsed.data)) return;
		
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
		txDate = todayInTimeZone(financeStore.settings.timeZone);
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

	function processTranscript() {
		const nextDrafts = parseSpeechBatch(transcript, financeStore.categories, { date: todayInTimeZone(financeStore.settings.timeZone), locale: financeStore.settings.locale });
		if (!nextDrafts.length) {
			showToastMsg('No identifiqué montos en el dictado. Puedes corregir el texto e intentarlo otra vez.', 'error');
			return;
		}
		voiceDrafts = nextDrafts;
		voiceOperationId = crypto.randomUUID();
		savedVoiceBatchCount = 0;
		showToastMsg(`${nextDrafts.length} movimiento${nextDrafts.length === 1 ? '' : 's'} listo${nextDrafts.length === 1 ? '' : 's'} para revisar`, 'info');
	}

	function updateVoiceDraft(id: string, update: Partial<SpeechTransactionDraft>, resolvedReason?: SpeechTransactionDraft['reviewReasons'][number]) {
		voiceDrafts = voiceDrafts.map((draft) => draft.id === id
			? { ...draft, ...update, reviewReasons: resolvedReason ? draft.reviewReasons.filter((reason) => reason !== resolvedReason) : draft.reviewReasons }
			: draft);
	}

	function setVoiceDraftType(id: string, nextType: 'income' | 'expense') {
		const nextCategory = categories.find((category) => category.type === nextType && !category.id.startsWith('__'));
		updateVoiceDraft(id, {
			type: nextType,
			categoryCode: nextType === 'income' ? 'income' : 'food',
			categoryId: nextCategory?.id || (nextType === 'income' ? '6' : '1')
		}, 'type');
	}

	function removeVoiceDraft(id: string) {
		voiceDrafts = voiceDrafts.filter((draft) => draft.id !== id);
		if (!voiceDrafts.length) voiceOperationId = null;
	}

	function cancelVoiceReview() {
		voiceDrafts = [];
		voiceOperationId = null;
	}

	function isValidVoiceDate(value: string): boolean {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
		const [year, month, day] = value.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
	}

	function confirmVoiceBatch() {
		if (!voiceOperationId || !voiceDrafts.length || isConfirmingVoiceBatch) return;
		isConfirmingVoiceBatch = true;
		try {
			if (!financeStore.accounts.some((account) => account.id === accountId)) throw new Error('Selecciona una cuenta válida.');
			if (voiceDrafts.some((draft) => draft.reviewReasons.length > 0)) throw new Error('Confirma el tipo y la categoría marcados antes de guardar.');
			if (voiceDrafts.some((draft) => !Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0 || !isValidVoiceDate(draft.date) || !categories.some((category) => category.id === draft.categoryId && category.type === draft.type))) {
				throw new Error('Revisa monto, categoría y fecha de cada movimiento.');
			}
			const batch: Transaction[] = voiceDrafts.map((draft) => ({
				id: crypto.randomUUID(),
				date: dateTimeFromDateOnly(draft.date, financeStore.settings.timeZone),
				amount: Number(draft.amount),
				categoryId: draft.categoryId,
				accountId,
				note: draft.note.trim() || undefined,
				type: draft.type
			}));
			if (!financeStore.addTransactionBatch(batch, voiceOperationId)) throw new Error('No se pudo guardar el lote. Revisa los movimientos antes de confirmar.');
			savedVoiceBatchCount = batch.length;
			voiceDrafts = [];
			voiceOperationId = null;
			transcript = '';
			vibrate(20);
			showToastMsg(`${batch.length} movimiento${batch.length === 1 ? '' : 's'} guardado${batch.length === 1 ? '' : 's'}`, 'success');
		} catch (error) {
			showToastMsg(error instanceof Error ? error.message : 'No se pudo preparar el lote.', 'error');
		} finally {
			isConfirmingVoiceBatch = false;
		}
	}

	function undoVoiceBatch() {
		if (!financeStore.undoLastAddedTransactionBatch()) return;
		showToastMsg(`${savedVoiceBatchCount} movimiento${savedVoiceBatchCount === 1 ? '' : 's'} revertido${savedVoiceBatchCount === 1 ? '' : 's'}`, 'info');
		savedVoiceBatchCount = 0;
	}

	function startRecording() {
		if (isRecording) {
			activeRecognition?.stop();
			return;
		}
		if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
			showToastMsg('Tu navegador no soporta voz', 'error');
			return;
		}

		isRecording = true;
		dictationResult = '🎙️ Escuchando...';
		const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
		const recognition = new SpeechRecognition();
		activeRecognition = recognition;

		recognition.lang = financeStore.settings.locale;
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;

		recognition.onresult = (event: any) => {
			transcript = event.results[0][0].transcript;
			dictationResult = `✓ "${transcript}"`;
			processTranscript();
			
			vibrate(15);
			toastStore.add('Voz procesada', 'info');
		};

		recognition.onerror = () => {
			isRecording = false;
			activeRecognition = null;
			dictationResult = '❌ Error al escuchar';
		};

		recognition.onend = () => {
			isRecording = false;
			activeRecognition = null;
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
		<p class="mb-4 text-xs" style="color: var(--color-text-secondary);">El reconocimiento lo proporciona tu navegador; la aplicación no envía la transcripción a servicios externos.</p>
		<button
			onclick={startRecording}
			data-testid="voice-record"
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

	{#if transcript}
		<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface);">
			<label for="voice-transcript" class="block text-sm font-semibold" style="color: var(--color-text);">Transcripción</label>
			<textarea id="voice-transcript" data-testid="voice-transcript" bind:value={transcript} rows="2" class="mt-2 w-full rounded-xl p-3 text-sm outline-none focus:ring-2" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"></textarea>
			<div class="mt-3 flex gap-2">
				<button onclick={processTranscript} data-testid="voice-process" class="rounded-xl px-4 py-2 text-sm font-semibold text-white" style="background-color: var(--color-primary);">Procesar texto</button>
				<p class="self-center text-xs" style="color: var(--color-text-secondary);">Se procesa en este dispositivo; no se guarda hasta confirmar.</p>
			</div>
		</div>
	{/if}

	{#if voiceDrafts.length}
		<section class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface); border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));">
			<div class="mb-4">
				<h2 class="text-lg font-semibold" style="color: var(--color-text);">Revisa antes de guardar</h2>
				<p class="mt-1 text-sm" style="color: var(--color-text-secondary);">Edita cada movimiento detectado. Nada cambiará tus saldos hasta que confirmes.</p>
			</div>

			<div class="mb-4">
				<label for="voice-account" class="block text-xs font-medium" style="color: var(--color-text-secondary);">Cuenta para este lote</label>
				<select id="voice-account" bind:value={accountId} class="mt-1 w-full rounded-xl p-3 text-sm outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);">
					{#each financeStore.accounts as acc}
						<option value={acc.id}>{acc.name} ({financeStore.formatCurrency(acc.balance, acc.currency)})</option>
					{/each}
				</select>
			</div>

			<div class="space-y-3">
				{#each voiceDrafts as draft (draft.id)}
					<div class="rounded-xl p-4" style="background-color: var(--color-bg); border: 1px solid var(--color-border);">
						<div class="mb-3 flex items-center justify-between gap-3">
							<p class="text-sm font-semibold" style="color: var(--color-text);">Movimiento detectado</p>
							<button onclick={() => removeVoiceDraft(draft.id)} aria-label="Quitar movimiento" class="rounded-lg p-1.5" style="color: var(--color-danger);"><X size={16} /></button>
						</div>
						{#if draft.reviewReasons.length}
							<p class="mb-3 rounded-lg p-2 text-xs font-medium" style="background-color: color-mix(in srgb, var(--color-warning) 14%, var(--color-surface)); color: var(--color-text);">Confirma {draft.reviewReasons.includes('type') ? 'el tipo' : ''}{draft.reviewReasons.includes('type') && draft.reviewReasons.includes('category') ? ' y ' : ''}{draft.reviewReasons.includes('category') ? 'la categoría' : ''}: la transcripción no pudo inferirlo con seguridad.</p>
						{/if}
						<div class="grid grid-cols-2 gap-3">
							<label class="text-xs font-medium" style="color: var(--color-text-secondary);">Tipo
								<select value={draft.type} onchange={(event) => setVoiceDraftType(draft.id, (event.currentTarget as HTMLSelectElement).value as 'income' | 'expense')} class="mt-1 w-full rounded-lg p-2.5 text-sm" style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);">
									<option value="expense">Gasto</option>
									<option value="income">Ingreso</option>
								</select>
							</label>
							<label class="text-xs font-medium" style="color: var(--color-text-secondary);">Monto
								<input type="number" min="0.01" step="0.01" value={draft.amount} oninput={(event) => updateVoiceDraft(draft.id, { amount: Number((event.currentTarget as HTMLInputElement).value) })} class="mt-1 w-full rounded-lg p-2.5 text-sm" style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);" />
							</label>
							<label class="col-span-2 text-xs font-medium" style="color: var(--color-text-secondary);">Categoría
								<select value={draft.categoryId} onchange={(event) => updateVoiceDraft(draft.id, { categoryId: (event.currentTarget as HTMLSelectElement).value }, 'category')} class="mt-1 w-full rounded-lg p-2.5 text-sm" style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);">
									{#each categories.filter((category) => category.type === draft.type && !category.id.startsWith('__')) as category}
										<option value={category.id}>{categoryDisplayName(category, financeStore.settings.locale)}</option>
									{/each}
								</select>
							</label>
							<label class="col-span-2 text-xs font-medium" style="color: var(--color-text-secondary);">Detalle
								<input type="text" value={draft.note} oninput={(event) => updateVoiceDraft(draft.id, { note: (event.currentTarget as HTMLInputElement).value })} class="mt-1 w-full rounded-lg p-2.5 text-sm" style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);" />
							</label>
							<label class="col-span-2 text-xs font-medium" style="color: var(--color-text-secondary);">Fecha
								<input type="date" value={draft.date} max={maxTransactionDate} onchange={(event) => updateVoiceDraft(draft.id, { date: (event.currentTarget as HTMLInputElement).value })} class="mt-1 w-full rounded-lg p-2.5 text-sm" style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);" />
							</label>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-5 flex gap-3">
				<button onclick={confirmVoiceBatch} data-testid="voice-confirm" disabled={isConfirmingVoiceBatch} class="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white disabled:opacity-50" style="background-color: var(--color-primary);"><Save size={18} /> Confirmar {voiceDrafts.length}</button>
				<button onclick={cancelVoiceReview} class="rounded-xl px-4 py-3 text-sm font-semibold" style="background-color: var(--color-bg); color: var(--color-text-secondary); border: 1px solid var(--color-border);">Cancelar</button>
			</div>
		</section>
	{/if}

	{#if savedVoiceBatchCount > 0}
		<div class="flex items-center justify-between gap-3 rounded-2xl p-4" style="background-color: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));">
			<p class="text-sm font-medium" style="color: var(--color-text);">Se guardaron {savedVoiceBatchCount} movimiento{savedVoiceBatchCount === 1 ? '' : 's'}.</p>
			<button onclick={undoVoiceBatch} data-testid="voice-undo" class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold" style="color: var(--color-primary);"><Undo2 size={16} /> Deshacer</button>
		</div>
	{/if}

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
					data-testid="transaction-type-transfer"
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
					Monto ({selectedAccount?.currency || financeStore.settings.baseCurrency}) <span class="font-normal opacity-70">(soporta sumas ej. 15+20)</span>
				</label>
				<input id="a11y-1"
					data-testid="transaction-amount"
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
							<option value={acc.id}>{acc.name} ({financeStore.formatCurrency(acc.balance, acc.currency)})</option>
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
								<option value={acc.id}>{acc.name} ({financeStore.formatCurrency(acc.balance, acc.currency)})</option>
							{/each}
						</select>
					</div>
				{/if}
				{#if type === 'transfer' && financeStore.accounts.find((account) => account.id === accountId)?.currency !== financeStore.accounts.find((account) => account.id === toAccountId)?.currency}
					<div>
						<label class="block text-xs font-medium" style="color: var(--color-text-secondary);" for="transfer-destination-amount">Monto que recibe ({selectedDestinationAccount?.currency || financeStore.settings.baseCurrency}, opcional)</label>
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
							<option value={cat.id}>{categoryDisplayName(cat, financeStore.settings.locale)}</option>
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
					max={maxTransactionDate}
					class="mt-1 w-full rounded-xl p-3.5 text-sm outline-none transition-all focus:ring-2"
					style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border); color-scheme: {document?.documentElement?.classList?.contains('dark') ? 'dark' : 'light'};"
				/>
			</div>

			<!-- Submit -->
			<button
				onclick={saveTransaction}
				data-testid="transaction-save"
				class="flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold text-white shadow-lg transition-all active:scale-95"
				style="background-color: var(--color-primary);"
			>
				<Save size={20} />
				<span>Guardar</span>
			</button>
		</div>
	</div>
</div>
