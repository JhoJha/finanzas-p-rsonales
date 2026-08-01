import { describe, expect, it } from 'vitest';
import type { Account, Transaction } from '$lib/schema';
import { parseAndValidateBackup } from '$lib/utils/backup';
import { dateFromDateOnly } from '$lib/utils/date';
import {
	applyTransactionToAccountBalances,
	isValidDebtPayment,
	projectDebtRepayment,
	transactionAmountInBase
} from '$lib/utils/finance';
import { calculateCashForecast, detectSubscriptions } from '$lib/utils/forecast';
import { buildMonthlyReview, buildNetWorthHistory } from '$lib/utils/insights';

const accounts: Account[] = [
	{ id: 'cash', name: 'Efectivo', type: 'cash', initialBalance: 100, balance: 100, currency: 'PEN' },
	{ id: 'bank', name: 'Banco', type: 'bank', initialBalance: 10, balance: 10, currency: 'PEN' }
];

describe('reglas financieras', () => {
	it('recalcula saldos para ingresos, gastos y transferencias', () => {
		const transfer: Transaction = {
			id: 'transfer-1', date: '2026-07-31T12:00:00.000Z', amount: 35, categoryId: 'transfer',
			accountId: 'cash', toAccountId: 'bank', type: 'transfer'
		};
		const afterTransfer = applyTransactionToAccountBalances(accounts, transfer);
		expect(afterTransfer.map((account) => account.balance)).toEqual([65, 45]);

		const income: Transaction = { ...transfer, id: 'income-1', amount: 20, accountId: 'cash', type: 'income', toAccountId: undefined };
		expect(applyTransactionToAccountBalances(afterTransfer, income)[0].balance).toBe(85);

		const crossCurrency = { ...transfer, id: 'transfer-usd', amount: 75, toAmount: 20 };
		expect(applyTransactionToAccountBalances(accounts, crossCurrency).map((account) => account.balance)).toEqual([25, 30]);
	});

	it('conserva la tasa histórica aunque se actualice la configuración', () => {
		const transaction: Transaction = {
			id: 'usd-1', date: '2026-07-31T12:00:00.000Z', amount: 10, categoryId: 'income', accountId: 'usd', type: 'income', exchangeRate: 3.75, baseCurrency: 'PEN'
		};
		expect(transactionAmountInBase(transaction, 'USD', { baseCurrency: 'PEN', exchangeRates: { USD: 4 } })).toBe(37.5);
	});

	it('rechaza abonos de deuda inválidos o mayores al saldo pendiente', () => {
		expect(isValidDebtPayment(50, 50)).toBe(true);
		expect(isValidDebtPayment(51, 50)).toBe(false);
		expect(isValidDebtPayment(0, 50)).toBe(false);
	});

	it('proyecta una deuda con interés y detecta cuotas insuficientes', () => {
		const projection = projectDebtRepayment(1200, 12, 110);
		expect(projection.monthsRemaining).not.toBeNull();
		expect(projection.estimatedInterest).toBeGreaterThan(0);
		expect(projectDebtRepayment(1200, 12, 10).monthsRemaining).toBeNull();
	});

	it('valida referencias antes de restaurar un backup', () => {
		const validBackup = {
			version: 3,
			transactions: [],
			categories: [{ id: 'food', name: 'Comida', icon: 'tag', color: 'bg-blue-500', type: 'expense' }],
			goals: [],
			accounts: [{ id: 'cash', name: 'Efectivo', type: 'cash', balance: 0, currency: 'PEN' }],
			budgets: [], recurringTransactions: [], debts: [],
			settings: { baseCurrency: 'PEN', exchangeRates: { USD: 3.75 } }
		};
		expect(parseAndValidateBackup(JSON.stringify(validBackup)).accounts).toHaveLength(1);
		expect(() => parseAndValidateBackup(JSON.stringify({ ...validBackup, budgets: [{ id: 'b1', categoryId: 'missing', amount: 10, period: 'monthly' }] }))).toThrow('presupuesto');
	});

	it('interpreta las fechas de vencimiento como fechas locales de calendario', () => {
		const dueDate = dateFromDateOnly('2026-02-15');
		expect([dueDate.getFullYear(), dueDate.getMonth() + 1, dueDate.getDate()]).toEqual([2026, 2, 15]);
	});

	it('detecta pagos mensuales y proyecta el flujo de caja', () => {
		const transactions: Transaction[] = ['2026-05-05', '2026-06-05', '2026-07-05'].map((date, index) => ({
			id: `netflix-${index}`, date: `${date}T12:00:00.000Z`, timestamp: new Date(`${date}T12:00:00.000Z`).getTime(), amount: index === 2 ? 25 : 20,
			categoryId: 'food', accountId: 'cash', type: 'expense', note: 'NETFLIX.COM'
		}));
		const settings = { baseCurrency: 'PEN', exchangeRates: {} };
		const detected = detectSubscriptions(transactions, accounts, settings, new Date('2026-07-31T12:00:00'));
		expect(detected).toHaveLength(1);
		expect(detected[0].monthlyCost).toBe(25);
		expect(detected[0].changePercent).toBe(25);
		const forecast = calculateCashForecast(accounts, transactions, [{ id: 'salary', amount: 100, categoryId: 'income', accountId: 'cash', type: 'income', frequency: 'monthly', nextDate: '2026-07-31' }], [], [], [], settings, new Date('2026-07-31T12:00:00'));
		expect(forecast.expectedIncome).toBe(100);
		expect(forecast.forecastBalance).toBeGreaterThan(forecast.currentBalance);
	});

	it('resume el mes y reconstruye el patrimonio neto', () => {
		const transactions: Transaction[] = [
			{ id: 'income', date: '2026-06-10T12:00:00.000Z', timestamp: new Date('2026-06-10T12:00:00.000Z').getTime(), amount: 100, categoryId: 'income', accountId: 'cash', type: 'income' },
			{ id: 'expense', date: '2026-06-12T12:00:00.000Z', timestamp: new Date('2026-06-12T12:00:00.000Z').getTime(), amount: 30, categoryId: 'food', accountId: 'cash', type: 'expense' },
			{ id: 'saving', date: '2026-06-15T12:00:00.000Z', timestamp: new Date('2026-06-15T12:00:00.000Z').getTime(), amount: 20, linkedAmount: 20, categoryId: '__savings__', accountId: 'cash', type: 'expense', goalId: 'goal' }
		];
		const settings = { baseCurrency: 'PEN', exchangeRates: {} };
		const review = buildMonthlyReview(transactions, accounts, [{ id: 'food', name: 'Comida', icon: 'tag', color: 'bg-blue-500', type: 'expense' }], [{ id: 'goal', name: 'Emergencia', targetAmount: 20, currentAmount: 20 }], settings, 1, new Date('2026-06-30T12:00:00'));
		expect(review.net).toBe(50);
		expect(review.completedGoals).toEqual(['Emergencia']);
		const history = buildNetWorthHistory(accounts, transactions, [{ id: 'goal', name: 'Emergencia', targetAmount: 20, currentAmount: 20 }], [], settings, 1, new Date('2026-06-30T12:00:00'));
		expect(history[0].savings).toBe(20);
		expect(history[0].netWorth).toBe(180);
	});
});
