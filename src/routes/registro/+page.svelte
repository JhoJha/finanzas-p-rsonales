<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import type { Transaction } from '$lib/schema';
	import { Mic, MicOff, Save } from '@lucide/svelte';
	import { parseSpeech } from '$lib/utils/speechParser';

	let amount = $state('');
	let categoryId = $state('1'); // Default: Alimentación
	let type = $state<'expense' | 'income'>('expense');
	let note = $state('');
	let isRecording = $state(false);
	let dictationResult = $state('');

	const categories = financeStore.categories;

	function saveTransaction() {
		if (!amount || isNaN(parseFloat(amount))) return alert('Monto inválido');

		const newTx: Transaction = {
			id: crypto.randomUUID(),
			date: new Date().toISOString(),
			amount: parseFloat(amount),
			categoryId,
			note,
			type
		};
		financeStore.addTransaction(newTx);

		// Reset fields
		amount = '';
		note = '';
		dictationResult = 'Guardado con éxito!';
		setTimeout(() => dictationResult = '', 3000);
	}

	function startRecording() {
		if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
			alert('Tu navegador no soporta el reconocimiento de voz.');
			return;
		}

		isRecording = true;
		const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
		const recognition = new SpeechRecognition();
		
		recognition.lang = 'es-ES';
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;

		recognition.onresult = (event: any) => {
			const transcript = event.results[0][0].transcript;
			dictationResult = `Escuchado: "${transcript}"`;
			
			const parsed = parseSpeech(transcript);
			if (parsed.amount) amount = parsed.amount.toString();
			categoryId = parsed.categoryId;
			type = parsed.type;
			note = transcript;
		};

		recognition.onerror = (event: any) => {
			console.error(event.error);
			isRecording = false;
		};

		recognition.onend = () => {
			isRecording = false;
		};

		recognition.start();
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-gray-900">Registro Rápido</h1>

	<!-- Voice UI -->
	<div class="rounded-2xl bg-white p-6 text-center shadow-sm">
		<p class="mb-4 text-sm text-gray-600">Presiona para dictar un gasto (ej. "Me gasté 15 soles en almuerzo")</p>
		<button
			onclick={startRecording}
			class="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 {isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}"
		>
			{#if isRecording}
				<MicOff size={32} />
			{:else}
				<Mic size={32} />
			{/if}
		</button>
		
		{#if dictationResult}
			<p class="mt-4 text-sm font-medium text-blue-600">{dictationResult}</p>
		{/if}
	</div>

	<!-- Form UI -->
	<div class="rounded-2xl bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-lg font-semibold border-b pb-2">O ingresa manualmente</h2>
		
		<div class="space-y-4">
			<!-- Tipo -->
			<div class="flex space-x-2">
				<button class="flex-1 rounded-lg py-2 text-sm font-semibold {type === 'expense' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}" onclick={() => type = 'expense'}>
					Gasto
				</button>
				<button class="flex-1 rounded-lg py-2 text-sm font-semibold {type === 'income' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}" onclick={() => type = 'income'}>
					Ingreso
				</button>
			</div>

			<!-- Monto -->
			<div>
				<label class="block text-xs font-medium text-gray-700">Monto (S/)</label>
				<input type="number" bind:value={amount} placeholder="0.00" class="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
			</div>

			<!-- Categoria -->
			<div>
				<label class="block text-xs font-medium text-gray-700">Categoría</label>
				<select bind:value={categoryId} class="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
					{#each categories.filter(c => c.type === type) as cat}
						<option value={cat.id}>{cat.name}</option>
					{/each}
				</select>
			</div>

			<!-- Nota -->
			<div>
				<label class="block text-xs font-medium text-gray-700">Nota / Detalle</label>
				<input type="text" bind:value={note} placeholder="Ej. Almuerzo con amigos" class="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
			</div>

			<!-- Submit -->
			<button onclick={saveTransaction} class="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 py-4 font-bold text-white transition-colors hover:bg-blue-700">
				<Save size={20} />
				<span>Guardar</span>
			</button>
		</div>
	</div>
</div>