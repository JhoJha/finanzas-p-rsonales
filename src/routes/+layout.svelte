<script lang="ts">
	import '../app.css';
	import { Home, PlusCircle, Target, TrendingUp, Sun, Moon } from '@lucide/svelte';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import ToastProvider from '$lib/components/ToastProvider.svelte';
	import { themeStore, themes } from '$lib/theme.svelte';
	import { Download } from '@lucide/svelte';
	import { financeStore } from '$lib/store.svelte';
	import { toastStore } from '$lib/toast.svelte';

	let { children } = $props();

	let isDark = $derived(themeStore.current === 'dark');
	let currentThemeColor = $derived(themes.find(t => t.id === themeStore.current)?.color || '#2563eb');

	let deferredPrompt = $state<any>(null);
	let showInstallBanner = $state(false);

	$effect(() => {
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
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Gestor Inteligente</title>
	<meta name="theme-color" content={currentThemeColor} />
</svelte:head>

<div class="flex h-screen flex-col" style="background-color: var(--color-bg); color: var(--color-text);">
	<ToastProvider />
	<!-- Header con gradiente -->
	<header
		class="relative p-4 pb-16 text-center shadow-lg"
		style="background: var(--gradient-header); color: var(--color-header-text);"
	>
		<h1 class="text-xl font-bold tracking-tight">Gestor Inteligente</h1>
		<p class="mt-0.5 text-xs opacity-80">Finanzas personales simplificadas</p>

		<!-- Botón modo oscuro -->
		<button
			onclick={() => themeStore.toggleDark()}
			class="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-transform active:scale-90"
			aria-label="Cambiar modo"
		>
			{#if isDark}
				<Sun size={16} />
			{:else}
				<Moon size={16} />
			{/if}
		</button>

		<ThemePicker />
	</header>

	{#if showInstallBanner}
		<div class="fixed top-20 left-4 right-4 z-50 animate-slide-down rounded-2xl p-4 shadow-lg flex items-center justify-between" style="background-color: var(--color-surface); border: 1px solid var(--color-primary);">
			<div class="flex items-center gap-3">
				<div class="rounded-xl p-2" style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary);">
					<Download size={20} />
				</div>
				<div>
					<p class="text-sm font-bold" style="color: var(--color-text);">Instalar App</p>
					<p class="text-xs" style="color: var(--color-text-secondary);">Acceso rápido y sin conexión</p>
				</div>
			</div>
			<div class="flex gap-2">
				<button onclick={() => (showInstallBanner = false)} class="px-2 text-xs font-medium" style="color: var(--color-text-secondary);">Quizás luego</button>
				<button onclick={installPWA} class="rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-sm" style="background-color: var(--color-primary);">Instalar</button>
			</div>
		</div>
	{/if}

	<!-- Main content (con margen negativo para solaparse con el header) -->
	<main class="relative -mt-12 flex-1 overflow-y-auto px-4 pb-32">
		{#if financeStore.isReady}
			{@render children()}
		{:else}
			<div class="flex h-64 items-center justify-center">
				<div class="h-10 w-10 animate-spin rounded-full border-4" style="border-color: var(--color-border); border-top-color: var(--color-primary);"></div>
			</div>
		{/if}
	</main>

	<!-- Bottom Navigation -->
	<nav
		class="fixed bottom-4 left-4 right-4 z-50 flex justify-between rounded-3xl px-6 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.1)] backdrop-blur-2xl transition-all border"
		style="background-color: {isDark ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.8)'}; border-color: {isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};"
	>
		<a
			href="/"
			class="flex flex-col items-center p-2 text-xs transition-colors"
			style="color: {page.url.pathname === '/' ? 'var(--color-primary)' : 'var(--color-text-secondary)'};"
		>
			<Home size={24} />
			<span>Resumen</span>
		</a>
		<a
			href="/registro"
			class="flex flex-col items-center p-2 text-xs transition-colors"
			style="color: {page.url.pathname === '/registro' ? 'var(--color-primary)' : 'var(--color-text-secondary)'};"
		>
			<PlusCircle size={24} />
			<span>Registro</span>
		</a>
		<a
			href="/ahorro"
			class="flex flex-col items-center p-2 text-xs transition-colors"
			style="color: {page.url.pathname === '/ahorro' ? 'var(--color-primary)' : 'var(--color-text-secondary)'};"
		>
			<Target size={24} />
			<span>Guardadito</span>
		</a>
		<a
			href="/analisis"
			class="flex flex-col items-center p-2 text-xs transition-colors"
			style="color: {page.url.pathname === '/analisis' ? 'var(--color-primary)' : 'var(--color-text-secondary)'};"
		>
			<TrendingUp size={24} />
			<span>Análisis</span>
		</a>
	</nav>
</div>

