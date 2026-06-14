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
				accountId: t.accountId || 'default-cash',
				timestamp: t.timestamp ?? new Date(t.date).getTime()
			})).filter((t: any) => TransactionSchema.safeParse(t).success);
		}
		this.isReady = true;
	}

	addTransaction(transaction: Transaction) {
		if (!transaction.timestamp) {
			transaction.timestamp = new Date(transaction.date).getTime();
		}
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
			const updated = { ...this.data[index], ...updateData };
			if (updateData.date) {
				updated.timestamp = new Date(updated.date).getTime();
			}
			this.data[index] = updated;
			this.save();
		}
	}

	save() {
		saveToStorage('finances_transactions', $state.snapshot(this.data));
	}
}
