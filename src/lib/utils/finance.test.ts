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
});
