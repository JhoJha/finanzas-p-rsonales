import { type RecurringTransaction, RecurringTransactionSchema } from '../schema';
import { loadFromStorage, saveToStorage } from './storage';

export class RecurringStore {
	data = $state<RecurringTransaction[]>([]);
	isReady = $state(false);

	async init() {
		const stored = await loadFromStorage<any[]>('finances_recurring', []);
		if (stored && stored.length > 0) {
			this.data = stored.filter(r => RecurringTransactionSchema.safeParse(r).success);
		}
		this.isReady = true;
	}

	addRecurringTransaction(rt: RecurringTransaction) {
		this.data.push(rt);
		this.save();
	}

	deleteRecurringTransaction(id: string) {
		this.data = this.data.filter(rt => rt.id !== id);
		this.save();
	}

	updateRecurringTransactions(updated: RecurringTransaction[]) {
		this.data = updated;
		this.save();
	}

	save() {
		saveToStorage('finances_recurring', $state.snapshot(this.data));
	}
}
