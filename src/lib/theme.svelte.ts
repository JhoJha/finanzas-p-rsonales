import { browser } from '$app/environment';

export type ThemeId = 'ocean' | 'nature' | 'rose' | 'purple' | 'sunset' | 'dark';

export interface ThemeOption {
	id: ThemeId;
	name: string;
	color: string;
	icon: string;
}

export const themes: ThemeOption[] = [
	{ id: 'ocean', name: 'Océano', color: '#2563eb', icon: '🌊' },
	{ id: 'nature', name: 'Naturaleza', color: '#16a34a', icon: '🌿' },
	{ id: 'rose', name: 'Rosa', color: '#db2777', icon: '🌸' },
	{ id: 'purple', name: 'Púrpura', color: '#7c3aed', icon: '🟣' },
	{ id: 'sunset', name: 'Atardecer', color: '#ea580c', icon: '🌅' },
	{ id: 'dark', name: 'Nocturno', color: '#0f172a', icon: '🌙' }
];

function getInitialTheme(): ThemeId {
	if (browser) {
		const stored = localStorage.getItem('finances_theme') as ThemeId | null;
		if (stored && themes.some((t) => t.id === stored)) return stored;

		// Detectar preferencia del sistema para modo oscuro
		if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			return 'dark';
		}
	}
	return 'ocean';
}

class ThemeStore {
	current = $state<ThemeId>(getInitialTheme());

	constructor() {
		if (browser) {
			this.applyTheme(this.current);

			// Escuchar cambios en la preferencia del sistema
			window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
				// Solo cambiar si el usuario no ha escogido manualmente un tema
				const stored = localStorage.getItem('finances_theme');
				if (!stored) {
					this.current = e.matches ? 'dark' : 'ocean';
					this.applyTheme(this.current);
				}
			});
		}
	}

	applyTheme(theme: ThemeId) {
		document.documentElement.setAttribute('data-theme', theme);
		// También agregamos una clase para Tailwind
		document.documentElement.classList.remove('ocean', 'nature', 'rose', 'purple', 'sunset', 'dark');
		document.documentElement.classList.add(theme);
	}

	setTheme(theme: ThemeId) {
		this.current = theme;
		this.applyTheme(theme);
		if (browser) {
			localStorage.setItem('finances_theme', theme);
		}
	}

	toggleDark() {
		if (this.current === 'dark') {
			this.setTheme('ocean');
		} else {
			this.setTheme('dark');
		}
	}
}

export const themeStore = new ThemeStore();
