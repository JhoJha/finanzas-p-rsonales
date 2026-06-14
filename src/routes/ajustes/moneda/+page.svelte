<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { ArrowLeft, Save } from '@lucide/svelte';

	let settings = $derived(financeStore.settings);
	
	// Create local copies for editing
	let baseCurrency = $state(financeStore.settings?.baseCurrency || 'PEN');
	
	// Stringify the rates map for easy text editing
	let exchangeRatesText = $state(
		Object.entries(financeStore.settings?.exchangeRates || {})
			.map(([curr, rate]) => `${curr}: ${rate}`)
			.join('\n')
	);

	function saveSettings() {
		try {
			const newRates: Record<string, number> = {};
			
			const lines = exchangeRatesText.split('\n').map(l => l.trim()).filter(Boolean);
			for (const line of lines) {
				const parts = line.split(':');
				if (parts.length !== 2) throw new Error(`Formato inválido en la línea: ${line}`);
				
				const curr = parts[0].trim().toUpperCase();
				const rate = parseFloat(parts[1].trim());
				
				if (isNaN(rate) || rate <= 0) throw new Error(`Tasa inválida para ${curr}`);
				
				newRates[curr] = rate;
			}
			
			financeStore.updateSettings({
				baseCurrency: baseCurrency.toUpperCase(),
				exchangeRates: newRates
			});
			
			toastStore.add('Configuración guardada', 'success');
		} catch (e: any) {
			toastStore.add(e.message, 'error');
		}
	}
</script>

<div class="animate-fade-in-up space-y-6">
	<div class="flex items-center gap-3">
		<a href="/ajustes" class="rounded-full p-2 hover:bg-black/5" style="color: var(--color-text);">
			<ArrowLeft size={24} />
		</a>
		<h1 class="text-2xl font-bold" style="color: var(--color-text);">Moneda</h1>
	</div>

	<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
		<h2 class="mb-2 font-semibold" style="color: var(--color-text);">Moneda Base</h2>
		<p class="mb-4 text-xs" style="color: var(--color-text-secondary);">Esta es la moneda en la que se mostrará tu Saldo Total y tus Análisis globales.</p>
		
		<input type="text" bind:value={baseCurrency} placeholder="PEN, USD, EUR..." class="w-full rounded-xl p-3 outline-none uppercase font-bold" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" />
	</div>

	<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
		<h2 class="mb-2 font-semibold" style="color: var(--color-text);">Tasas de Cambio</h2>
		<p class="mb-4 text-xs" style="color: var(--color-text-secondary);">Define cuánto vale 1 unidad de otra moneda en tu Moneda Base. Formato: <code>MONEDA: TASA</code> (una por línea).</p>
		
		<textarea bind:value={exchangeRatesText} rows="4" class="w-full rounded-xl p-3 outline-none font-mono text-sm" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" placeholder="USD: 3.75&#10;EUR: 4.10"></textarea>
		
		<div class="mt-3 rounded-lg p-3 text-xs" style="background-color: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-secondary);">
			<strong>Ejemplo:</strong> Si tu moneda base es PEN, y tienes una cuenta en USD, "USD: 3.75" significa que 1 USD equivale a 3.75 PEN.
		</div>
	</div>

	<button
		onclick={saveSettings}
		class="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white transition-all active:scale-95"
		style="background-color: var(--color-primary);"
	>
		<Save size={20} /> Guardar Cambios
	</button>
</div>
