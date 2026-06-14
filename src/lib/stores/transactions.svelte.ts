import { type Transaction, TransactionSchema } from '../schema';
import { loadFromStorage, saveToStorage } from './storage';

export class TransactionsStore {
	data = $state<Transaction[]>([]);
	isReady = $state(false);

	async init() {
		const stored = await loadFromStorage<any[]>('finances_transactions', []);
		if (stored && Array.isArray(stored)) {
			this.data = stored.map((t: any) => ({
				...t,
				accountId: t.accountId || 'default-cash'
			})).filter((t: any) => TransactionSchema.safeParse(t).success);
		}
		this.isReady = true;
	}

	addTransaction(transaction: Transaction) {
		this.data.push(transaction);
		this.save();
	}

	deleteTransaction(id: string) {
		this.data = this.data.filter((t) => t.id !== id);
		this.save();
	}

	updateTransaction(id: string, updateData: Partial<Transaction>) {
		const index = this.data.findIndex((t) => t.id === id);
		if (index !== -1) {
			this.data[index] = { ...this.data[index], ...updateData };
			this.save();
		}
	}

	save() {
		saveToStorage('finances_transactions', $state.snapshot(this.data));
	}
}
