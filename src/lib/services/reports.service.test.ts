import { describe, expect, it } from 'vitest';
import { ReportsService } from '$lib/services/reports.service';
import { createFinanceState, createTransaction } from '$lib/test/factories';

describe('ReportsService', () => {
	it('calcula el presupuesto y el resumen sin modificar el estado de entrada', () => {
		const state = createFinanceState({
			budgets: [{ id: 'food', categoryId: '1', amount: 300, period: 'monthly', alertThreshold: 50 }],
			transactions: [createTransaction({ amount: 180 })]
		});
		const amountInBase = (transaction: typeof state.transactions[number]) => transaction.amount;
		const now = new Date('2026-08-15T12:00:00.000Z');

		expect(ReportsService.budgetProgress(state, 'food', amountInBase, now)).toMatchObject({ spent: 180, available: 120, percent: 60 });
		expect(ReportsService.budgetAlerts(state, amountInBase, now)).toHaveLength(1);
		expect(ReportsService.summary(state, amountInBase)).toMatchObject({ expenses: 180, income: 0, balance: 500, savings: 0 });
		expect(state.transactions).toHaveLength(1);
	});
});
