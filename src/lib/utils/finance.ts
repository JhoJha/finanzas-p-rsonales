import type { Account, Settings, Transaction } from '$lib/schema';

type CurrencySettings = Pick<Settings, 'baseCurrency' | 'exchangeRates'>;

/** Devuelve cuántas unidades de la moneda base representa una unidad de `currency`. */
export function getExchangeRateToBase(currency: string | undefined, settings: CurrencySettings): number {
	const from = (currency || settings.baseCurrency).toUpperCase();
	return from === settings.baseCurrency.toUpperCase() ? 1 : settings.exchangeRates[from] ?? 1;
}

export function convertAmountToBase(amount: number, exchangeRate: number): number {
	return amount * exchangeRate;
}

export function transactionAmountInBase(
	transaction: Transaction,
	currency: string | undefined,
	settings: CurrencySettings
): number {
	return convertAmountToBase(
		transaction.amount,
		transaction.exchangeRate ?? getExchangeRateToBase(currency, settings)
	);
}

/** Calcula el cambio en cada cuenta sin mutar el estado. */
export function getAccountBalanceDeltas(transaction: Transaction, multiplier = 1): Map<string, number> {
	const deltas = new Map<string, number>();
	const add = (accountId: string, amount: number) => deltas.set(accountId, (deltas.get(accountId) ?? 0) + amount);

	if (transaction.type === 'income') add(transaction.accountId, transaction.amount * multiplier);
	if (transaction.type === 'expense') add(transaction.accountId, -transaction.amount * multiplier);
	if (transaction.type === 'transfer' && transaction.toAccountId) {
		add(transaction.accountId, -transaction.amount * multiplier);
		add(transaction.toAccountId, transaction.amount * multiplier);
	}

	return deltas;
}

export function applyTransactionToAccountBalances(
	accounts: Account[],
	transaction: Transaction,
	multiplier = 1
): Account[] {
	const deltas = getAccountBalanceDeltas(transaction, multiplier);
	return accounts.map((account) => ({
		...account,
		balance: account.balance + (deltas.get(account.id) ?? 0)
	}));
}

export function isValidDebtPayment(amount: number, remaining: number): boolean {
	return Number.isFinite(amount) && amount > 0 && amount <= remaining;
}
