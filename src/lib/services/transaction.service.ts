import type { Account, Transaction } from '$lib/schema';

export class TransactionService {
	static applyAccountEffect(accounts: Account[], transaction: Transaction, multiplier: number): Account[] {
		return accounts.map((account) => {
			let delta = 0;
			if (transaction.type === 'income' && transaction.accountId === account.id) delta = transaction.amount;
			if (transaction.type === 'expense' && transaction.accountId === account.id) delta = -transaction.amount;
			if (transaction.type === 'transfer') {
				if (transaction.accountId === account.id) delta = -transaction.amount;
				if (transaction.toAccountId === account.id) delta = transaction.toAmount ?? transaction.amount;
			}
			return delta ? { ...account, balance: account.balance + delta * multiplier } : account;
		});
	}
}
