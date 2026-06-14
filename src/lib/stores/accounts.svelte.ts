import { type Account, AccountSchema } from '../schema';
import { loadFromStorage, saveToStorage } from './storage';

export class AccountsStore {
	data = $state<Account[]>([{ id: 'default-cash', name: 'Efectivo General', type: 'cash', balance: 0, color: 'bg-green-500' }]);
	isReady = $state(false);

	async init() {
		const stored = await loadFromStorage<any[]>('finances_accounts', []);
		if (stored && stored.length > 0) {
			const parsed = stored.filter(a => AccountSchema.safeParse(a).success);
			if (parsed.length > 0) this.data = parsed;
		}
		this.isReady = true;
		
		// Set up auto-save using Svelte 5 $effect.root or handled by the Facade
	}

	addAccount(account: Account) {
		this.data.push(account);
		this.save();
	}

	removeAccount(id: string) {
		this.data = this.data.filter(a => a.id !== id);
		this.save();
	}

	updateBalance(id: string, amount: number) {
		const account = this.data.find(a => a.id === id);
		if (account) {
			account.balance += amount;
			this.save();
		}
	}

	setBalance(id: string, amount: number) {
		const account = this.data.find(a => a.id === id);
		if (account) {
			account.balance = amount;
			this.save();
		}
	}
	
	save() {
		saveToStorage('finances_accounts', $state.snapshot(this.data));
	}
}
