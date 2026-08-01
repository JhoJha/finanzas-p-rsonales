import { describe, expect, it } from 'vitest';
import type { Account, RecurringTransaction, Transaction } from '$lib/schema';
import { FinanceStoreFacade } from '$lib/store.svelte';
import { parseAndValidateBackup } from '$lib/utils/backup';
import { dateFromDateOnly } from '$lib/utils/date';
import {
	applyTransactionToAccountBalances,
	getExchangeRateToBase,
	getMissingExchangeRateCurrencies,
	isValidDebtPayment,
	projectDebtRepayment,
	transactionAmountInBase
} from '$lib/utils/finance';
import { calculateCashForecast, detectSubscriptions } from '$lib/utils/forecast';
import { buildMonthlyReview, buildNetWorthHistory, invalidateNetWorthSnapshotsFrom } from '$lib/utils/insights';
import { parseBankDate, parseImportAmount, parseImportCsv } from '$lib/utils/import';
import { ratesToBaseCurrency, shouldRefreshExchangeRates } from '$lib/utils/exchange-rates';

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

	it('evita duplicar recurrentes dentro del presupuesto y no fuerza deudas sin cuota', () => {
		const settings = { baseCurrency: 'PEN', exchangeRates: {} };
		const forecast = calculateCashForecast(accounts, [], [{ id: 'rent', amount: 20, categoryId: 'food', accountId: 'cash', type: 'expense', frequency: 'monthly', nextDate: '2026-07-31' }], [{ id: 'debt', type: 'i_owe', contactName: 'Banco', totalAmount: 500, paidAmount: 0, status: 'pending' }], [{ id: 'food-budget', categoryId: 'food', amount: 100, period: 'monthly' }], [], settings, new Date('2026-07-31T12:00:00'));
		expect(forecast.scheduledExpenses).toBe(20);
		expect(forecast.budgetReserve).toBe(80);
		expect(forecast.debtPayments).toBe(0);
	});

	it('importa Debe/Haber y rechaza fechas de calendario imposibles', () => {
		const rows = parseImportCsv('Fecha;Descripción;Debe;Haber\n30/07/2026;Supermercado;25,50;\n31/07/2026;Sueldo;;1000', [{ id: 'food', name: 'Supermercado', icon: 'tag', color: 'bg-blue-500', type: 'expense' }, { id: 'income', name: 'Sueldo', icon: 'briefcase', color: 'bg-green-500', type: 'income' }], []);
		expect(rows.map((row) => row.amount)).toEqual([-25.5, 1000]);
		expect(parseBankDate('31/02/2026')).toBeNull();
	});

	it('convierte tasas del proveedor a la moneda base y respeta el intervalo diario', () => {
		expect(ratesToBaseCurrency([{ base: 'PEN', quote: 'USD', rate: 0.25, date: '2026-07-31' }], 'PEN', ['USD'])).toEqual({ USD: 4 });
		expect(shouldRefreshExchangeRates('2026-07-31T10:00:00.000Z', Date.parse('2026-08-01T09:59:59.999Z'))).toBe(false);
		 expect(shouldRefreshExchangeRates('2026-07-31T10:00:00.000Z', Date.parse('2026-08-01T10:00:00.000Z'))).toBe(true);
	});
});

describe('resiliencia P6.2/P6.3', () => {
	it('no convierte una moneda sin tasa como si fuera 1:1', () => {
		expect(() => getExchangeRateToBase('USD', { baseCurrency: 'PEN', exchangeRates: {} })).toThrow('Falta la tasa');
		expect(getMissingExchangeRateCurrencies([{ currency: 'USD' }, { currency: 'EUR' }, { currency: 'PEN' }], { baseCurrency: 'PEN', exchangeRates: { EUR: 4.2 } })).toEqual(['USD']);
	});

	it('rechaza respaldos con una cuenta extranjera sin tasa', () => {
		const backup = {
			version: 3, transactions: [], categories: [], goals: [], budgets: [], recurringTransactions: [], debts: [],
			accounts: [{ id: 'usd', name: 'Dólares', type: 'bank', balance: 0, currency: 'USD' }],
			settings: { baseCurrency: 'PEN', exchangeRates: {} }
		};
		expect(() => parseAndValidateBackup(JSON.stringify(backup))).toThrow('tasa para USD');
	});

	it('no proyecta dos veces una cuota de deuda ya pagada este mes', () => {
		const settings = { baseCurrency: 'PEN', exchangeRates: {} };
		const payment: Transaction = { id: 'payment', date: '2026-07-15T12:00:00.000Z', timestamp: new Date('2026-07-15T12:00:00.000Z').getTime(), amount: 100, linkedAmount: 100, categoryId: '__debt-payment__', accountId: 'cash', type: 'expense', debtId: 'debt' };
		const forecast = calculateCashForecast(accounts, [payment], [], [{ id: 'debt', type: 'i_owe', contactName: 'Banco', totalAmount: 500, paidAmount: 100, installmentAmount: 100, status: 'pending' }], [], [], settings, new Date('2026-07-31T12:00:00'));
		expect(forecast.debtPayments).toBe(0);
	});

	it('interpreta importes bancarios internacionales y negativos', () => {
		expect(parseImportAmount('1,234.56')).toBe(1234.56);
		expect(parseImportAmount('1 234,56')).toBe(1234.56);
		expect(parseImportAmount('(35.50)')).toBe(-35.5);
		expect(parseImportAmount('-35,50')).toBe(-35.5);
	});

	it('mantiene un cierre mensual aunque cambie la tasa actual', () => {
		const history = buildNetWorthHistory(
			[{ id: 'usd', name: 'Dólares', type: 'bank', initialBalance: 10, balance: 10, currency: 'USD', createdAt: '2026-06-01T12:00:00.000Z' }],
			[], [], [],
			{ baseCurrency: 'PEN', exchangeRates: { USD: 5 }, netWorthSnapshots: [{ month: '2026-06-01', accounts: 40, savings: 0, receivables: 0, debts: 0, netWorth: 40, capturedAt: '2026-07-01T00:00:00.000Z' }] },
			1, new Date('2026-06-30T12:00:00.000Z')
		);
		expect(history[0].netWorth).toBe(40);
	});

	it('invalida solo los cierres afectados por una corrección histórica', () => {
		const snapshots = [
			{ month: '2026-04-01', accounts: 10, savings: 0, receivables: 0, debts: 0, netWorth: 10, capturedAt: '2026-05-01T00:00:00.000Z' },
			{ month: '2026-05-01', accounts: 20, savings: 0, receivables: 0, debts: 0, netWorth: 20, capturedAt: '2026-06-01T00:00:00.000Z' },
			{ month: '2026-06-01', accounts: 30, savings: 0, receivables: 0, debts: 0, netWorth: 30, capturedAt: '2026-07-01T00:00:00.000Z' }
		];
		expect(invalidateNetWorthSnapshotsFrom(snapshots, '2026-05-17T12:00:00.000Z').map((snapshot) => snapshot.month)).toEqual(['2026-04-01']);
	});

	it('acepta una cuota recurrente vinculada y evita sumarla dos veces en el pronóstico', () => {
		const settings = { baseCurrency: 'PEN', exchangeRates: {} };
		const forecast = calculateCashForecast(
			accounts, [], [{ id: 'debt-payment', amount: 100, categoryId: '__debt-payment__', accountId: 'cash', type: 'expense', debtId: 'debt', frequency: 'monthly', nextDate: '2026-07-31' }],
			[{ id: 'debt', type: 'i_owe', contactName: 'Banco', totalAmount: 500, paidAmount: 0, installmentAmount: 100, status: 'pending' }], [], [], settings, new Date('2026-07-31T12:00:00')
		);
		expect(forecast.scheduledExpenses).toBe(100);
		expect(forecast.debtPayments).toBe(0);
	});

	it('rechaza respaldos con un recurrente vinculado a una deuda inexistente', () => {
		const backup = {
			transactions: [], categories: [], goals: [], budgets: [], debts: [],
			accounts: [{ id: 'cash', name: 'Efectivo', type: 'cash', balance: 0, currency: 'PEN' }],
			recurringTransactions: [{ id: 'r1', amount: 50, categoryId: '__debt-payment__', accountId: 'cash', type: 'expense', debtId: 'missing', frequency: 'monthly', nextDate: '2026-08-01' }],
			settings: { baseCurrency: 'PEN', exchangeRates: {} }
		};
		expect(() => parseAndValidateBackup(JSON.stringify(backup))).toThrow('recurrente vinculado');
	});

	it('aplica el mismo abono de deuda al aprobar, eliminar y deshacer un recurrente', () => {
		const store = new FinanceStoreFacade();
		const internal = store as unknown as {
			accountsStore: { data: Account[] };
			recurringStore: { data: RecurringTransaction[] };
		};
		internal.accountsStore.data = [{ id: 'cash', name: 'Efectivo', type: 'cash', initialBalance: 500, balance: 500, currency: 'PEN' }];
		expect(store.addDebt({ id: 'debt', type: 'i_owe', contactName: 'Banco', totalAmount: 500, paidAmount: 0, status: 'pending' })).toBe(true);
		internal.recurringStore.data = [{ id: 'recurring-debt', amount: 100, categoryId: '__debt-payment__', accountId: 'cash', debtId: 'debt', type: 'expense', frequency: 'monthly', nextDate: '2020-01-01' }];

		const pending = store.getPendingRecurringTransactions()[0];
		store.approvePendingRecurring(pending.rtId, pending.tx, true);
		expect(store.debts[0].paidAmount).toBe(100);
		expect(store.transactions).toHaveLength(1);

		expect(store.deleteTransaction(pending.tx.id)).toBe(true);
		expect(store.debts[0].paidAmount).toBe(0);
		expect(store.restoreLastDeletedTransaction()).toBe(true);
		expect(store.debts[0].paidAmount).toBe(100);
	});
});
