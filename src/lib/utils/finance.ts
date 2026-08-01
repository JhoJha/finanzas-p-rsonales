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

export interface DebtProjection {
	remaining: number;
	monthlyRate: number;
	suggestedInstallment: number;
	monthsRemaining: number | null;
	estimatedInterest: number | null;
}

/** Proyección simple con cuota fija; no modifica el saldo registrado de la deuda. */
export function projectDebtRepayment(
	remaining: number,
	interestRateAnnual = 0,
	installmentAmount?: number
): DebtProjection {
	const monthlyRate = interestRateAnnual / 100 / 12;
	const minimumPayment = monthlyRate > 0 ? remaining * monthlyRate + remaining / 12 : remaining / 12;
	const suggestedInstallment = installmentAmount ?? Math.ceil(minimumPayment * 100) / 100;
	if (remaining <= 0) return { remaining: 0, monthlyRate, suggestedInstallment: 0, monthsRemaining: 0, estimatedInterest: 0 };
	if (suggestedInstallment <= remaining * monthlyRate) return { remaining, monthlyRate, suggestedInstallment, monthsRemaining: null, estimatedInterest: null };

	let balance = remaining;
	let interest = 0;
	let months = 0;
	while (balance > 0.01 && months < 600) {
		const monthInterest = balance * monthlyRate;
		interest += monthInterest;
		balance = balance + monthInterest - suggestedInstallment;
		months += 1;
	}
	return balance > 0 ? { remaining, monthlyRate, suggestedInstallment, monthsRemaining: null, estimatedInterest: null } : {
		remaining,
		monthlyRate,
		suggestedInstallment,
		monthsRemaining: months,
		estimatedInterest: Math.round(interest * 100) / 100
	};
}
