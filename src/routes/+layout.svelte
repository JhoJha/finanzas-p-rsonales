<script lang="ts">
	import '../app.css';
	import { Home, PlusCircle, Target, TrendingUp, Sun, Moon, Settings, Download, Plus, Search } from '@lucide/svelte';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import ToastProvider from '$lib/components/ToastProvider.svelte';
	import { themeStore, themes } from '$lib/theme.svelte';
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';
	import { vibrate } from '$lib/utils/haptics';
	import { verifyPin } from '$lib/utils/security';

	let { children } = $props();

	let isDark = $derived(themeStore.current === 'dark');
	let currentThemeColor = $derived(themes.find(t => t.id === themeStore.current)?.color || '#2563eb');

	let deferredPrompt = $state<any>(null);
	let showInstallBanner = $state(false);
	let isIosInstallable = $state(false);
	let isLocked = $state(false);
	let lockPin = $state('');
	let lockError = $state('');
	let missingExchangeRateCurrencies = $derived(financeStore.missingExchangeRateCurrencies);
	let isReportRoute = $derived(['/', '/analisis', '/pronostico', '/cierre', '/patrimonio', '/presupuestos', '/suscripciones', '/buscar'].includes(page.url.pathname));
	let isReportBlocked = $derived(financeStore.isReady && missingExchangeRateCurrencies.length > 0 && isReportRoute);
	const INACTIVITY_LOCK_MS = 5 * 60 * 1000;
	let inactivityTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
			|| (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
		const isStandalone = window.matchMedia('(display-mode: standalone)').matches
			|| Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
		isIosInstallable = isIos && !isStandalone;
		if (isIosInstallable && sessionStorage.getItem('ios_install_dismissed') !== '1') showInstallBanner = true;

		const handleBeforeInstallPrompt = (e: any) => {
			e.preventDefault();
			deferredPrompt = e;
			showInstallBanner = true;
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		window.addEventListener('appinstalled', () => {
			showInstallBanner = false;
			deferredPrompt = null;
		});

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		};
	});

	$effect(() => {
		if (!financeStore.isReady) return;
		isLocked = Boolean(financeStore.settings.security) && sessionStorage.getItem('finances_unlocked') !== '1';
	});

	async function unlock() {
		const security = financeStore.settings.security;
		if (!security || !(await verifyPin(lockPin, security))) {
			lockError = 'PIN incorrecto.';
			return;
		}
		sessionStorage.setItem('finances_unlocked', '1');
		lockPin = '';
		lockError = '';
		isLocked = false;
	}

	function lockForInactivity() {
		sessionStorage.removeItem('finances_unlocked');
		lockPin = '';
		lockError = '';
		isLocked = true;
	}

	function resetInactivityTimer() {
		if (!financeStore.settings.security || isLocked) return;
		if (inactivityTimer) clearTimeout(inactivityTimer);
		inactivityTimer = setTimeout(lockForInactivity, INACTIVITY_LOCK_MS);
	}

	$effect(() => {
		if (!financeStore.isReady || !financeStore.settings.security || isLocked) {
			if (inactivityTimer) clearTimeout(inactivityTimer);
			return;
		}
		const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
		for (const event of activityEvents) window.addEventListener(event, resetInactivityTimer, { passive: true });
		resetInactivityTimer();
		return () => {
			if (inactivityTimer) clearTimeout(inactivityTimer);
			for (const event of activityEvents) window.removeEventListener(event, resetInactivityTimer);
		};
	});

	// Alerta proactiva de deudas vencidas (una vez por sesión)
	$effect(() => {
		const alreadyAlerted = sessionStorage.getItem('debt_alert_shown');
		if (alreadyAlerted) return;

		const overdue = financeStore.getOverdueDebts();
		if (overdue.length > 0) {
			sessionStorage.setItem('debt_alert_shown', '1');
			setTimeout(() => {
				toastStore.add(
					`⚠️ Tienes ${overdue.length} deuda${overdue.length > 1 ? 's' : ''} vencida${overdue.length > 1 ? 's' : ''}. Revisa la sección Deudas.`,
					'error',
					5000
				);
			}, 1000);
		}
	});

	// Alerta proactiva de transacciones recurrentes pendientes
	$effect(() => {
		if (!financeStore.isReady || missingExchangeRateCurrencies.length > 0) return;
		const alreadyAlertedRecurring = sessionStorage.getItem('recurring_alert_shown');
		if (alreadyAlertedRecurring) return;

		const pending = financeStore.getPendingRecurringTransactions();
		if (pending.length > 0) {
			sessionStorage.setItem('recurring_alert_shown', '1');
			setTimeout(() => {
				toastStore.add(
					`Tienes ${pending.length} transacción(es) recurrente(s) pendiente(s). Revisa la sección Recurrentes.`,
					'warning',
					7000
				);
			}, 1500);
		}
	});

	$effect(() => {
		if (!financeStore.isReady || missingExchangeRateCurrencies.length > 0) return;
		const alertKey = `budget_alerts_${new Date().toISOString().slice(0, 10)}`;
		if (sessionStorage.getItem(alertKey)) return;
		const alerts = financeStore.getBudgetAlerts();
		if (alerts.length === 0) return;
		sessionStorage.setItem(alertKey, '1');
		setTimeout(() => {
			toastStore.add(
				`Tienes ${alerts.length} presupuesto${alerts.length > 1 ? 's' : ''} cerca o por encima de su límite.`,
				'warning',
				7000
			);
		}, 2000);
	});

	async function installPWA() {
		if (deferredPrompt) {
			deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			if (outcome === 'accepted') {
				showInstallBanner = false;
			}
			deferredPrompt = null;
		}
	}

	function exportEmergencyBackup() {
		if (isLocked) return;
		const blob = new Blob([financeStore.exportToJSON()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `finanzas_respaldo_urgente_${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	function dismissInstallBanner() {
		showInstallBanner = false;
		if (isIosInstallable) sessionStorage.setItem('ios_install_dismissed', '1');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Gestor Inteligente</title>
	<meta name="theme-color" content={currentThemeColor} />
	<meta name="application-name" content="Gestor Inteligente" />
</svelte:head>

<a class="skip-link" href="#main-content">Saltar al contenido principal</a>
<div class="flex min-h-[100dvh] flex-col bg-bg text-text">
	<ToastProvider />
	{#if financeStore.persistenceStatus === 'error' && !isLocked}
		<div class="fixed left-4 right-4 top-3 z-[60] rounded-2xl p-3 shadow-lg" style="background-color: var(--color-surface); border: 1px solid var(--color-danger); color: var(--color-text);">
			<p class="text-sm font-semibold">No se guardaron los últimos cambios.</p>
			<p class="mt-1 text-xs" style="color: var(--color-text-secondary);">{financeStore.persistenceError} Exporta un respaldo antes de cerrar o recargar.</p>
			<button onclick={exportEmergencyBackup} class="mt-2 min-h-11 rounded-lg px-3 py-2 text-xs font-bold text-white" style="background-color: var(--color-danger);">Exportar respaldo ahora</button>
		</div>
	{:else if financeStore.persistenceStatus === 'saving'}
		<div class="fixed right-4 top-3 z-[60] rounded-full px-3 py-1 text-xs shadow" style="background-color: var(--color-surface); color: var(--color-text-secondary); border: 1px solid var(--color-border);">Guardando cambios…</div>
	{/if}
	{#if isLocked}
		<main id="main-content" tabindex="-1" class="flex flex-1 items-center justify-center p-6">
			<div class="w-full max-w-sm rounded-3xl p-6 text-center shadow-lg" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
				<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);">🔒</div>
				<h1 class="text-xl font-bold" style="color: var(--color-text);">Gestor bloqueado</h1>
				<p class="mt-2 text-sm" style="color: var(--color-text-secondary);">Ingresa tu PIN para acceder a tus finanzas.</p>
				<label for="app-unlock-pin" class="sr-only">PIN</label>
				<input id="app-unlock-pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8" bind:value={lockPin} onkeydown={(event) => { if (event.key === 'Enter') unlock(); }} aria-describedby={lockError ? 'app-unlock-error' : undefined} class="mt-5 w-full rounded-xl p-3 text-center text-lg tracking-[0.5em] outline-none" style="background-color: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);" />
				{#if lockError}<p id="app-unlock-error" role="alert" class="mt-2 text-xs" style="color: var(--color-danger);">{lockError}</p>{/if}
				<button onclick={unlock} class="mt-4 w-full rounded-xl py-3 font-bold text-white" style="background-color: var(--color-primary);">Desbloquear</button>
			</div>
		</main>
	{:else}
	<!-- Header con gradiente -->
	<header
		class="relative p-4 pb-16 text-center shadow-lg"
		style="background: var(--gradient-header); color: var(--color-header-text);"
	>
		<h1 class="text-xl font-bold tracking-tight">Gestor Inteligente</h1>
		<p class="mt-0.5 text-xs opacity-80">Finanzas personales simplificadas</p>

		<!-- Botón de Ajustes -->
		<a
			href="/ajustes"
			class="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-transform active:scale-90"
			aria-label="Ajustes"
		>
			<Settings size={20} />
		</a>
		<a href="/buscar" aria-label="Búsqueda global" class="absolute left-14 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-transform active:scale-90"><Search size={20} /></a>

		<button
			onclick={() => { vibrate(15); themeStore.toggleDark(); }}
			class="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-transform active:scale-90"
			aria-label="Cambiar modo"
			aria-pressed={isDark}
		>
			{#if isDark}
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
			{/if}
		</button>
	</header>

	{#if showInstallBanner}
		<div class="fixed top-20 left-4 right-4 z-50 animate-slide-down rounded-2xl p-4 shadow-lg flex items-center justify-between border border-primary bg-surface">
			<div class="flex items-center gap-3">
				<div class="rounded-xl p-2 bg-primary/15 text-primary">
					<Download size={20} />
				</div>
				<div>
					<p class="text-sm font-bold text-text">Instalar App</p>
					<p class="text-xs text-text-secondary">Acceso rápido y sin conexión</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				{#if isIosInstallable && !deferredPrompt}
					<p class="max-w-28 text-right text-xs font-medium text-text-secondary">En Safari: Compartir y «Añadir a inicio».</p>
				{:else}
					<button onclick={installPWA} class="min-h-11 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-sm bg-primary">Instalar</button>
				{/if}
				<button onclick={dismissInstallBanner} class="min-h-11 px-2 text-xs font-medium text-text-secondary" aria-label="Cerrar aviso de instalación">Ahora no</button>
			</div>
		</div>
	{/if}

	<!-- Main content (con margen negativo para solaparse con el header) -->
	<main id="main-content" tabindex="-1" class="relative -mt-12 flex-1 overflow-y-auto px-4 pb-36">
		{#if isReportBlocked}
			<div class="mx-auto max-w-lg rounded-2xl p-5 text-center shadow-sm" style="background-color: var(--color-surface); border: 1px solid var(--color-warning);">
				<h2 class="text-lg font-bold" style="color: var(--color-text);">Falta configurar una tasa de cambio</h2>
				<p class="mt-2 text-sm" style="color: var(--color-text-secondary);">No mostraremos reportes con cifras incompletas. Configura una tasa para {missingExchangeRateCurrencies.join(', ')} y vuelve a intentarlo.</p>
				<a href="/ajustes/moneda" class="mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-bold text-white" style="background-color: var(--color-primary);">Configurar tasas</a>
			</div>
		{:else if financeStore.isReady}
			{@render children()}
		{:else}
			<div class="space-y-5 animate-pulse opacity-70">
				<!-- Skeleton Balance -->
				<div class="flex flex-col items-center justify-center rounded-2xl p-6 shadow-sm" style="background-color: var(--color-surface);">
					<div class="h-4 w-40 rounded-full mb-4" style="background-color: var(--color-border);"></div>
					<div class="h-12 w-56 rounded-full" style="background-color: var(--color-border);"></div>
				</div>
				<!-- Skeleton Cuentas -->
				<div class="flex gap-4 overflow-hidden pb-4 pt-2">
					<div class="min-w-[260px] h-36 rounded-3xl shadow-md" style="background-color: var(--color-surface);"></div>
					<div class="min-w-[260px] h-36 rounded-3xl shadow-md" style="background-color: var(--color-surface);"></div>
				</div>
				<!-- Skeleton Stats -->
				<div class="grid grid-cols-2 gap-4">
					<div class="h-28 rounded-2xl shadow-sm" style="background-color: var(--color-surface);"></div>
					<div class="h-28 rounded-2xl shadow-sm" style="background-color: var(--color-surface);"></div>
				</div>
			</div>
		{/if}
	</main>

	<!-- Bottom Navigation -->
	<nav
		aria-label="NavegaciÃ³n principal"
		class="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-50 flex items-center justify-between rounded-3xl px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.1)] backdrop-blur-2xl transition-all border"
		style="background-color: {isDark ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.8)'}; border-color: {isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};"
	>
		<a
			href="/"
			aria-current={page.url.pathname === '/' ? 'page' : undefined}
			class="flex min-h-11 min-w-11 flex-col items-center justify-center p-2 text-xs transition-colors"
			style="color: {page.url.pathname === '/' ? 'var(--color-primary)' : 'var(--color-text-secondary)'};"
		>
			<Home size={24} />
			<span>Resumen</span>
		</a>
		<a
			href="/registro"
			onclick={() => vibrate(15)}
			aria-label="Registrar movimiento"
			class="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
		>
			<Plus size={28} />
		</a>
		<a
			href="/ahorro"
			aria-current={page.url.pathname === '/ahorro' ? 'page' : undefined}
			class="flex min-h-11 min-w-11 flex-col items-center justify-center p-2 text-xs transition-colors"
			style="color: {page.url.pathname === '/ahorro' ? 'var(--color-primary)' : 'var(--color-text-secondary)'};"
		>
			<Target size={24} />
			<span>Guardadito</span>
		</a>
		<a
			href="/analisis"
			aria-current={page.url.pathname === '/analisis' ? 'page' : undefined}
			class="flex min-h-11 min-w-11 flex-col items-center justify-center p-2 text-xs transition-colors"
			style="color: {page.url.pathname === '/analisis' ? 'var(--color-primary)' : 'var(--color-text-secondary)'};"
		>
			<TrendingUp size={24} />
			<span>Análisis</span>
		</a>
	</nav>
	{/if}
</div>
