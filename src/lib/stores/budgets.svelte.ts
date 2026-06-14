import { type Budget, BudgetSchema } from '../schema';
import { loadFromStorage, saveToStorage } from './storage';

export class BudgetsStore {
	data = $state<Budget[]>([]);
	isReady = $state(false);

	async init() {
		const stored = await loadFromStorage<any[]>('finances_budgets', []);
		if (stored && stored.length > 0) {
			this.data = stored.filter(b => BudgetSchema.safeParse(b).success);
		}
		this.isReady = true;
	}

	addBudget(budget: Budget) {
		this.data.push(budget);
		this.save();
	}

	deleteBudget(id: string) {
		this.data = this.data.filter(b => b.id !== id);
		this.save();
	}

	save() {
		saveToStorage('finances_budgets', $state.snapshot(this.data));
	}
}
