<script lang="ts">
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { Download, Upload, Settings, User } from '@lucide/svelte';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import { themeStore, themes, type ThemeId } from '$lib/theme.svelte';
	import { vibrate } from '$lib/utils/haptics';
	import type { BackupPreview } from '$lib/utils/backup';

	import { exportTransactionsToCSV } from '$lib/utils/csv';

	let pendingImportText = $state<string | null>(null);
	let pendingImportPreview = $state<BackupPreview | null>(null);

	function exportData() {
		const backup = JSON.parse(financeStore.exportToJSON()) as Record<string, unknown>;
		backup.theme = themeStore.current;
		const json = JSON.stringify(backup, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `finanzas_backup_${new Date().toISOString().split('T')[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
		vibrate(20);
		toastStore.add('📦 Backup exportado correctamente');
	}

	function exportCSV() {
		const csv = exportTransactionsToCSV();
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `finanzas_transacciones_${new Date().toISOString().split('T')[0]}.csv`;
		a.click();
		URL.revokeObjectURL(url);
		vibrate(20);
		toastStore.add('📊 CSV exportado correctamente');
	}

	function importData() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async (e: any) => {
			const file = e.target?.files?.[0];
			if (!file) return;
			const text = await file.text();
			const preview = financeStore.previewImport(text);
			if (!preview.valid) {
				vibrate([50, 50, 50]);
				toastStore.add(preview.error || 'Archivo inválido o corrupto', 'error');
				return;
			}
			pendingImportText = text;
			pendingImportPreview = preview;
			return;
			try {
				const backup = JSON.parse(text) as { theme?: unknown };
				if (!financeStore.importFromJSON(text)) throw new Error('Invalid backup');
				if (typeof backup.theme === 'string' && themes.some(theme => theme.id === backup.theme)) {
					themeStore.setTheme(backup.theme as ThemeId);
				}
				vibrate([10, 30, 10]);
				toastStore.add('📦 Datos importados correctamente');
			} catch {
				vibrate([50, 50, 50]);
				toastStore.add('❌ Archivo inválido o corrupto', 'error');
			}
		};
		input.click();
	}

	function restorePreviewedBackup() {
		if (!pendingImportText) return;
		try {
			const backup = JSON.parse(pendingImportText) as { theme?: unknown };
			if (!financeStore.importFromJSON(pendingImportText)) throw new Error('Invalid backup');
			if (typeof backup.theme === 'string' && themes.some(theme => theme.id === backup.theme)) {
				themeStore.setTheme(backup.theme as ThemeId);
			}
			pendingImportText = null;
			pendingImportPreview = null;
			vibrate([10, 30, 10]);
			toastStore.add('Datos restaurados correctamente');
		} catch {
			vibrate([50, 50, 50]);
			toastStore.add('No se pudo restaurar el backup', 'error');
		}
	}
</script>

<div class="animate-fade-in-up space-y-6">
	<div class="flex items-center gap-3">
		<Settings size={28} style="color: var(--color-primary);" />
		<h1 class="text-2xl font-bold" style="color: var(--color-text);">Ajustes</h1>
	</div>

	<ThemePicker />

	<div class="mb-6 rounded-2xl p-5 shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
		<h2 class="mb-4 text-lg font-semibold" style="color: var(--color-text);">Personalización y Administración</h2>
		{#if pendingImportPreview?.valid && pendingImportPreview.counts}
			<div class="mb-4 rounded-xl p-3 text-sm" style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent); border: 1px solid var(--color-primary); color: var(--color-text);">
				<p class="font-semibold">Vista previa del backup v{pendingImportPreview.version ?? 'anterior'}</p>
				<p class="mt-1 text-xs" style="color: var(--color-text-secondary);">
					{pendingImportPreview.counts.transactions} movimientos · {pendingImportPreview.counts.accounts} cuentas · {pendingImportPreview.counts.categories} categorías · {pendingImportPreview.counts.goals} metas · {pendingImportPreview.counts.debts} deudas
				</p>
				<div class="mt-3 flex gap-2">
					<button onclick={() => { pendingImportText = null; pendingImportPreview = null; }} class="flex-1 rounded-lg py-2 text-xs font-semibold" style="background-color: var(--color-bg); color: var(--color-text);">Cancelar</button>
					<button onclick={restorePreviewedBackup} class="flex-1 rounded-lg py-2 text-xs font-semibold text-white" style="background-color: var(--color-primary);">Restaurar ahora</button>
				</div>
			</div>
		{/if}

		<div class="flex flex-col gap-3">
			<a href="/ajustes/perfil" class="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-black/5" style="background-color: var(--color-bg);">
				<div class="flex items-center gap-3">
					<User size={20} style="color: var(--color-primary);" />
					<span class="font-medium" style="color: var(--color-text);">Mi Perfil</span>
				</div>
				<span style="color: var(--color-text-secondary);">➔</span>
			</a>
			<a href="/ajustes/cuentas" class="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-black/5" style="background-color: var(--color-bg);">
				<div class="flex items-center gap-3">
					<span class="text-xl">💳</span>
					<span class="font-medium" style="color: var(--color-text);">Mis Cuentas</span>
				</div>
				<span style="color: var(--color-text-secondary);">➔</span>
			</a>
			<a href="/ajustes/categorias" class="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-black/5" style="background-color: var(--color-bg);">
				<div class="flex items-center gap-3">
					<span class="text-xl">🎨</span>
					<span class="font-medium" style="color: var(--color-text);">Categorías</span>
				</div>
				<span style="color: var(--color-text-secondary);">➔</span>
			</a>
			<a href="/ajustes/moneda" class="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-black/5" style="background-color: var(--color-bg);">
				<div class="flex items-center gap-3">
					<span class="text-xl">🌍</span>
					<span class="font-medium" style="color: var(--color-text);">Moneda y Cambio</span>
				</div>
				<span style="color: var(--color-text-secondary);">➔</span>
			</a>
			<a href="/ajustes/seguridad" class="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-black/5" style="background-color: var(--color-bg);">
				<div class="flex items-center gap-3"><span class="text-xl">🔒</span><span class="font-medium" style="color: var(--color-text);">Privacidad y bloqueo</span></div>
				<span style="color: var(--color-text-secondary);">→</span>
			</a>
		</div>
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
				onclick={exportCSV}
				class="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95"
				style="background-color: color-mix(in srgb, #10b981 10%, transparent); color: #10b981;"
			>
				<Download size={18} /> Exportar Excel (.csv)
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
