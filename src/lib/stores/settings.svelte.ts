import { type Settings, SettingsSchema } from '../schema';
import { loadFromStorage, saveToStorage } from './storage';

export class SettingsStore {
	data = $state<Settings>({
		baseCurrency: 'PEN',
		exchangeRates: { 'USD': 3.75, 'EUR': 4.05 },
		profile: {
			name: '',
			avatar: '👋',
			usePhoto: false
		}
	});
	isReady = $state(false);

	async init() {
		const stored = await loadFromStorage<any>('finances_settings', null);
		if (stored) {
			const parsed = SettingsSchema.safeParse(stored);
			if (parsed.success) {
				this.data = parsed.data;
			}
		}
		this.isReady = true;
	}

	updateSettings(newData: Partial<Settings>) {
		this.data = { ...this.data, ...newData };
		this.save();
	}

	save() {
		saveToStorage('finances_settings', $state.snapshot(this.data));
	}
}
