import type { Account, Budget, Category, Debt, RecurringTransaction, Settings, Transaction } from '$lib/schema';
import { getExchangeRateToBase, transactionAmountInBase } from '$lib/utils/finance';

export interface DetectedSubscription {
	merchant: string;
	categoryId: string;
	accountId: string;
	monthlyCost: number;
	annualCost: number;
	nextDate: Date;
	lastDate: Date;
	occurrences: number;
	changePercent: number;
}

export interface CashForecast {
	asOf: Date;
	endDate: Date;
	currentBalance: number;
	expectedIncome: number;
	scheduledExpenses: number;
	subscriptionExpenses: number;
	debtPayments: number;
	budgetReserve: number;
	forecastBalance: number;
}

export function subscriptionMerchantName(note: string | undefined, categoryId: string): string {
	return (note || categoryId)
		.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.replace(/\d{3,}/g, ' ').replace(/[^a-zA-Z0-9 ]/g, ' ')
		.replace(/\b(?:compra|consumo|pago|pos|visa|mastercard|debito|credito|online|pe|peru)\b/gi, ' ')
		.replace(/\s+/g, ' ').trim().toUpperCase() || 'MOVIMIENTO';
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

/** Encuentra gastos similares con una cadencia semanal, quincenal o mensual. */
export function detectSubscriptions(transactions: Transaction[], accounts: Account[], settings: Pick<Settings, 'baseCurrency' | 'exchangeRates'>, now = new Date()): DetectedSubscription[] {
	const accountMap = new Map(accounts.map((account) => [account.id, account]));
	const grouped = new Map<string, Transaction[]>();
	for (const transaction of transactions) {
		if (transaction.type !== 'expense' || transaction.categoryId.startsWith('__') || !transaction.note?.trim()) continue;
		const merchant = subscriptionMerchantName(transaction.note, transaction.categoryId);
		const key = `${transaction.accountId}|${merchant}`;
		grouped.set(key, [...(grouped.get(key) ?? []), transaction]);
	}

	return [...grouped.values()].flatMap((items) => {
		const sorted = [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
		if (sorted.length < 3) return [];
		const gaps = sorted.slice(1).map((item, index) => (new Date(item.date).getTime() - new Date(sorted[index].date).getTime()) / 86400000);
		const cadence = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
		const isWeekly = cadence >= 6 && cadence <= 9;
		const isBiweekly = cadence >= 12 && cadence <= 17;
		const isMonthly = cadence >= 24 && cadence <= 38;
		if (!isWeekly && !isBiweekly && !isMonthly) return [];
		const amounts = sorted.map((item) => transactionAmountInBase(item, accountMap.get(item.accountId)?.currency, settings));
		const latest = amounts.at(-1)!;
		const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
		if (average === 0 || Math.max(...amounts) - Math.min(...amounts) > average * 0.6) return [];
		const historical = amounts.slice(0, -1);
		const historicalAverage = historical.reduce((sum, amount) => sum + amount, 0) / historical.length;
		let nextDate = addDays(new Date(sorted.at(-1)!.date), Math.round(cadence));
		while (nextDate <= now) nextDate = addDays(nextDate, Math.round(cadence));
		// El último cobro es la mejor estimación del próximo pago, especialmente
		// cuando el servicio acaba de aumentar su tarifa.
		const monthlyCost = latest * (isWeekly ? 4.345 : isBiweekly ? 2.1725 : 1);
		return [{
			merchant: subscriptionMerchantName(sorted[0].note, sorted[0].categoryId), categoryId: sorted[0].categoryId, accountId: sorted[0].accountId,
			monthlyCost: Math.round(monthlyCost * 100) / 100, annualCost: Math.round(monthlyCost * 12 * 100) / 100,
			nextDate, lastDate: new Date(sorted.at(-1)!.date), occurrences: sorted.length,
			changePercent: historicalAverage ? Math.round(((latest - historicalAverage) / historicalAverage) * 100) : 0
		}];
	}).sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
}

function occurrencesUntil(nextDate: string, frequency: RecurringTransaction['frequency'], endDate: Date, now: Date): Date[] {
	const current = new Date(`${nextDate}T12:00:00`);
	const dates: Date[] = [];
	while (current <= endDate) {
		if (current >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) dates.push(new Date(current));
		if (frequency === 'daily') current.setDate(current.getDate() + 1);
		else if (frequency === 'weekly') current.setDate(current.getDate() + 7);
		else if (frequency === 'biweekly') current.setDate(current.getDate() + 14);
		else current.setMonth(current.getMonth() + 1);
	}
	return dates;
}

export function calculateCashForecast(
	accounts: Account[], transactions: Transaction[], recurring: RecurringTransaction[], debts: Debt[], budgets: Budget[], categories: Category[], settings: Pick<Settings, 'baseCurrency' | 'exchangeRates'>, now = new Date()
): CashForecast {
	const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
	const currentBalance = accounts.reduce((sum, account) => sum + account.balance * getExchangeRateToBase(account.currency, settings), 0);
	let expectedIncome = 0, scheduledExpenses = 0, debtPayments = 0;
	const plannedByCategory = new Map<string, number>();
	const scheduledDebtIds = new Set<string>();
	for (const item of recurring) {
		const amount = item.amount * getExchangeRateToBase(accounts.find((account) => account.id === item.accountId)?.currency, settings);
		const count = occurrencesUntil(item.nextDate, item.frequency, endDate, now).length;
		if (item.type === 'income') expectedIncome += amount * count;
		if (item.type === 'expense') {
			scheduledExpenses += amount * count;
			plannedByCategory.set(item.categoryId, (plannedByCategory.get(item.categoryId) ?? 0) + amount * count);
			if (item.debtId && count > 0) scheduledDebtIds.add(item.debtId);
		}
	}
	const subscriptions = detectSubscriptions(transactions, accounts, settings, now);
	const recurringMerchants = new Set(recurring.filter((item) => item.type === 'expense').map((item) => subscriptionMerchantName(item.note, item.categoryId)));
	const pendingSubscriptions = subscriptions.filter((item) => item.nextDate <= endDate && !recurringMerchants.has(item.merchant));
	const subscriptionExpenses = pendingSubscriptions.reduce((sum, item) => sum + item.monthlyCost, 0);
	for (const item of pendingSubscriptions) plannedByCategory.set(item.categoryId, (plannedByCategory.get(item.categoryId) ?? 0) + item.monthlyCost);
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
	const paidThisMonth = new Map<string, number>();
	for (const transaction of transactions) {
		const timestamp = transaction.timestamp ?? new Date(transaction.date).getTime();
		if (transaction.debtId && timestamp >= monthStart) paidThisMonth.set(transaction.debtId, (paidThisMonth.get(transaction.debtId) ?? 0) + (transaction.linkedAmount ?? transactionAmountInBase(transaction, accounts.find((account) => account.id === transaction.accountId)?.currency, settings)));
	}
	for (const debt of debts) {
		if (debt.status !== 'pending' || (!debt.installmentAmount && !debt.dueDate) || (debt.dueDate && new Date(`${debt.dueDate}T23:59:59`) > endDate)) continue;
		if (scheduledDebtIds.has(debt.id)) continue;
		const remaining = debt.totalAmount - debt.paidAmount;
		const expectedPayment = Math.min(remaining, debt.installmentAmount ?? remaining);
		debtPayments += Math.max(0, expectedPayment - (paidThisMonth.get(debt.id) ?? 0));
	}
	const spentByCategory = new Map<string, number>();
	for (const item of transactions) if (item.type === 'expense' && (item.timestamp ?? new Date(item.date).getTime()) >= monthStart) spentByCategory.set(item.categoryId, (spentByCategory.get(item.categoryId) ?? 0) + transactionAmountInBase(item, accounts.find((account) => account.id === item.accountId)?.currency, settings));
	const budgetReserve = budgets.filter((budget) => budget.period === 'monthly').reduce((sum, budget) => sum + Math.max(0, budget.amount - (spentByCategory.get(budget.categoryId) ?? 0) - (plannedByCategory.get(budget.categoryId) ?? 0)), 0);
	return { asOf: now, endDate, currentBalance, expectedIncome, scheduledExpenses, subscriptionExpenses, debtPayments, budgetReserve, forecastBalance: currentBalance + expectedIncome - scheduledExpenses - subscriptionExpenses - debtPayments - budgetReserve };
}
