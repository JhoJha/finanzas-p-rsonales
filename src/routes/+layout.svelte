<script lang="ts">
	import '../app.css';
	import { Home, PlusCircle, Target, TrendingUp } from '@lucide/svelte';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Gestor Inteligente</title>
</svelte:head>

<div class="flex h-screen flex-col bg-gray-50 text-gray-900">
	<header class="bg-blue-600 p-4 text-center text-white shadow-md">
		<h1 class="text-xl font-bold">Gestor Inteligente</h1>
	</header>

	<main class="flex-1 overflow-y-auto p-4 pb-24">
		{@render children()}
	</main>

	<!-- Bottom Navigation -->
	<nav class="fixed bottom-0 left-0 right-0 z-50 flex justify-between border-t border-gray-200 bg-white p-2 px-6 pb-6 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
		<a href="/" class="flex flex-col items-center p-2 text-xs {page.url.pathname === '/' ? 'text-blue-600' : 'text-gray-500'}">
			<Home size={24} />
			<span>Resumen</span>
		</a>
		<a href="/registro" class="flex flex-col items-center p-2 text-xs {page.url.pathname === '/registro' ? 'text-blue-600' : 'text-gray-500'}">
			<PlusCircle size={24} />
			<span>Registro</span>
		</a>
		<a href="/ahorro" class="flex flex-col items-center p-2 text-xs {page.url.pathname === '/ahorro' ? 'text-blue-600' : 'text-gray-500'}">
			<Target size={24} />
			<span>Guardadito</span>
		</a>
		<a href="/analisis" class="flex flex-col items-center p-2 text-xs {page.url.pathname === '/analisis' ? 'text-blue-600' : 'text-gray-500'}">
			<TrendingUp size={24} />
			<span>Análisis</span>
		</a>
	</nav>
</div>

