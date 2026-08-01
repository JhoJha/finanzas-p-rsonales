import { type Debt, DebtSchema } from '../schema';
import { loadFromStorage, saveToStorage } from './storage';

export class DebtsStore {
	data = $state<Debt[]>([]);
	isReady = $state(false);

	async init() {
		const stored = await loadFromStorage<any[]>('finances_debts', []);
		if (stored && stored.length > 0) {
			this.data = stored.filter(d => DebtSchema.safeParse(d).success);
		}
		this.isReady = true;
	}

	addDebt(debt: Debt) {
		this.data.push(debt);
		this.save();
	}

	deleteDebt(id: string) {
		this.data = this.data.filter(d => d.id !== id);
		this.save();
	}

	updateDebt(id: string, updateFn: (debt: Debt) => void) {
		const debt = this.data.find(d => d.id === id);
		if (debt) {
			updateFn(debt);
			this.save();
		}
	}

	save() {
		void saveToStorage('finances_debts', $state.snapshot(this.data)).catch((error) => console.warn('Could not save legacy debts state', error));
	}
}
