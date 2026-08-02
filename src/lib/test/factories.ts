import { defaultCategories, type Account, type Debt, type Goal, type RecurringTransaction, type Settings, type Transaction } from '$lib/schema';
import type { FinanceState } from '$lib/repositories/finance.repository';

export const createSettings = (overrides: Partial<Settings> = {}): Settings => ({
	locale: 'es-PE', timeZone: 'America/Lima', baseCurrency: 'PEN', exchangeRates: {}, netWorthSnapshots: [], budgetAlertThreshold: 80,
	onboardingCompleted: false, savedFilters: [], importRules: [], profile: { name: '', avatar: '👋', usePhoto: false },
	...overrides
});

export const createAccount = (overrides: Partial<Account> = {}): Account => ({
	id: 'cash', name: 'Efectivo', type: 'cash', initialBalance: 500, balance: 500, currency: 'PEN', ...overrides
});

export const createDebt = (overrides: Partial<Debt> = {}): Debt => ({
	id: 'debt', type: 'i_owe', contactName: 'Banco', totalAmount: 500, paidAmount: 0, status: 'pending', ...overrides
});

export const createGoal = (overrides: Partial<Goal> = {}): Goal => ({
	id: 'goal', name: 'Emergencia', targetAmount: 1_000, currentAmount: 0, ...overrides
});

export const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
	id: 'transaction', date: '2026-08-01T12:00:00.000Z', timestamp: new Date('2026-08-01T12:00:00.000Z').getTime(),
	amount: 100, categoryId: '1', accountId: 'cash', type: 'expense', ...overrides
});

export const createRecurringDebtPayment = (overrides: Partial<RecurringTransaction> = {}): RecurringTransaction => ({
	id: 'recurring-debt', amount: 100, categoryId: '__debt-payment__', accountId: 'cash', debtId: 'debt', type: 'expense', frequency: 'monthly', nextDate: '2020-01-01', ...overrides
});

export const createFinanceState = (overrides: Partial<FinanceState> = {}): FinanceState => ({
	version: 9, transactions: [], categories: defaultCategories, goals: [], accounts: [createAccount()], budgets: [], recurringTransactions: [], debts: [], settings: createSettings(), ...overrides
});
