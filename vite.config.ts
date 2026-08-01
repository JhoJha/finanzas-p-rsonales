import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
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
				name: 'Gestor Inteligente',
				short_name: 'Gestor',
				description: 'Finanzas personales simplificadas',
				theme_color: '#2563eb',
				background_color: '#ffffff',
				display: 'standalone',
				icons: [
					{
						src: 'favicon.svg',
						sizes: '192x192 512x512',
						type: 'image/svg+xml'
					}
				]
			}
		})
	]
});
