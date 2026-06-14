<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { Download, Upload, Settings } from '@lucide/svelte';

	function exportData() {
		const json = financeStore.exportToJSON();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `finanzas_backup_${new Date().toISOString().split('T')[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toastStore.add('📦 Backup exportado correctamente');
	}

	function importData() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async (e: any) => {
			const file = e.target?.files?.[0];
			if (!file) return;
			const text = await file.text();
			if (financeStore.importFromJSON(text)) {
				toastStore.add('📦 Datos importados correctamente');
			} else {
				toastStore.add('❌ Archivo inválido o corrupto', 'error');
			}
		};
		input.click();
	}
</script>

<div class="animate-fade-in-up space-y-6">
	<div class="flex items-center gap-3">
		<Settings size={28} style="color: var(--color-primary);" />
		<h1 class="text-2xl font-bold" style="color: var(--color-text);">Ajustes</h1>
	</div>

	<div class="rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
		<h2 class="mb-2 text-lg font-semibold" style="color: var(--color-text);">Copia de Seguridad</h2>
		<p class="mb-4 text-sm" style="color: var(--color-text-secondary);">
			Exporta tus transacciones, metas, deudas y presupuestos para no perder tu información, o restáurala en otro dispositivo.
		</p>
		
		<div class="flex flex-col gap-3">
			<button
				onclick={exportData}
				class="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95"
				style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary);"
			>
				<Download size={18} /> Exportar Backup (.json)
			</button>
			<button
				onclick={importData}
				class="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95"
				style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);"
			>
				<Upload size={18} /> Importar Backup
			</button>
		</div>
	</div>
</div>
