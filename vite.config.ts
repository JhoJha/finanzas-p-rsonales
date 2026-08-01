import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { configDefaults } from 'vitest/config';

export default defineConfig({
	test: {
		exclude: [...configDefaults.exclude, 'e2e/**']
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		}),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			injectRegister: 'script',
			manifest: {
				lang: 'es',
				name: 'Gestor Inteligente',
				short_name: 'Gestor',
				description: 'Finanzas personales simplificadas',
				theme_color: '#2563eb',
				background_color: '#ffffff',
				display: 'standalone',
				icons: [
					{
						src: 'icon.svg',
						sizes: 'any',
						type: 'image/svg+xml'
					}
				]
			}
		})
	]
});
