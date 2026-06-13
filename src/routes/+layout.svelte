<script lang="ts">
	import '../app.css';
	import { Home, PlusCircle, Target, TrendingUp, Sun, Moon } from '@lucide/svelte';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import { themeStore } from '$lib/theme.svelte';

	let { children } = $props();

	let isDark = $derived(themeStore.current === 'dark');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Gestor Inteligente</title>
	<meta name="theme-color" content={isDark ? '#0f172a' : '#2563eb'} />
</svelte:head>

<div class="flex h-screen flex-col" style="background-color: var(--color-bg); color: var(--color-text);">
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

	<!-- Main content (con margen negativo para solaparse con el header) -->
	<main class="relative -mt-12 flex-1 overflow-y-auto px-4 pb-28">
		{@render children()}
	</main>

	<!-- Bottom Navigation -->
	<nav
		class="fixed bottom-0 left-0 right-0 z-50 flex justify-between border-t px-6 pb-6 pt-2 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]"
		style="background-color: var(--color-nav-bg); border-color: var(--color-border);"
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

