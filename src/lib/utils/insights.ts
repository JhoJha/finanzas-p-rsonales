import type { Account, Category, Debt, Goal, Settings, Transaction } from '$lib/schema';
import { getExchangeRateToBase, transactionAmountInBase } from '$lib/utils/finance';

export interface CategoryChange { categoryId: string; name: string; current: number; previous: number; change: number; percent: number; }
export interface MonthlyReview {
	month: Date; income: number; expenses: number; net: number; savingsRate: number; incomeChange: number; expenseChange: number;
	categoryChanges: CategoryChange[]; debtPaid: number; goalsContributed: number; completedGoals: string[]; subscriptionCount: number; recommendations: string[];
}
export interface NetWorthPoint { date: Date; label: string; accounts: number; savings: number; receivables: number; debts: number; netWorth: number; }

function monthWindow(date: Date) {
	const start = new Date(date.getFullYear(), date.getMonth(), 1);
	const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
	return { start, end };
}

function transactionBase(transaction: Transaction, accounts: Account[], settings: Pick<Settings, 'baseCurrency' | 'exchangeRates'>) {
	return transactionAmountInBase(transaction, accounts.find((account) => account.id === transaction.accountId)?.currency, settings);
}

function percentage(current: number, previous: number) { return previous ? Math.round(((current - previous) / previous) * 100) : current ? 100 : 0; }

export function buildMonthlyReview(transactions: Transaction[], accounts: Account[], categories: Category[], goals: Goal[], settings: Pick<Settings, 'baseCurrency' | 'exchangeRates'>, subscriptionCount: number, date = new Date()): MonthlyReview {
	const { start, end } = monthWindow(date);
	const previous = monthWindow(new Date(date.getFullYear(), date.getMonth() - 1, 1));
	const inWindow = (transaction: Transaction, window: { start: Date; end: Date }) => {
		const timestamp = transaction.timestamp ?? new Date(transaction.date).getTime();
		return timestamp >= window.start.getTime() && timestamp <= window.end.getTime();
	};
	const current = transactions.filter((transaction) => inWindow(transaction, { start, end }));
	const prior = transactions.filter((transaction) => inWindow(transaction, previous));
	const totals = (list: Transaction[]) => list.reduce((result, transaction) => {
		const amount = transactionBase(transaction, accounts, settings);
		if (transaction.type === 'income') result.income += amount;
		if (transaction.type === 'expense') result.expenses += amount;
		return result;
	}, { income: 0, expenses: 0 });
	const totalsCurrent = totals(current), totalsPrevious = totals(prior);
	const categoryTotal = (list: Transaction[]) => list.reduce((result, transaction) => {
		if (transaction.type === 'expense' && !transaction.categoryId.startsWith('__')) result.set(transaction.categoryId, (result.get(transaction.categoryId) ?? 0) + transactionBase(transaction, accounts, settings));
		return result;
	}, new Map<string, number>());
	const currentCategories = categoryTotal(current), previousCategories = categoryTotal(prior);
	const categoryChanges = [...new Set([...currentCategories.keys(), ...previousCategories.keys()])].map((categoryId) => {
		const value = currentCategories.get(categoryId) ?? 0, previousValue = previousCategories.get(categoryId) ?? 0;
		return { categoryId, name: categories.find((category) => category.id === categoryId)?.name ?? 'Otro', current: value, previous: previousValue, change: value - previousValue, percent: percentage(value, previousValue) };
	}).sort((a, b) => b.change - a.change).slice(0, 3);
	const debtPaid = current.filter((transaction) => transaction.debtId).reduce((sum, transaction) => sum + (transaction.linkedAmount ?? transactionBase(transaction, accounts, settings)), 0);
	const goalsContributed = current.filter((transaction) => transaction.goalId).reduce((sum, transaction) => sum + (transaction.linkedAmount ?? transactionBase(transaction, accounts, settings)), 0);
	const completedGoals = goals.filter((goal) => {
		const previousContributions = transactions.filter((transaction) => transaction.goalId === goal.id && (transaction.timestamp ?? new Date(transaction.date).getTime()) < start.getTime()).reduce((sum, transaction) => sum + (transaction.linkedAmount ?? transactionBase(transaction, accounts, settings)), 0);
		return previousContributions < goal.targetAmount && previousContributions + current.filter((transaction) => transaction.goalId === goal.id).reduce((sum, transaction) => sum + (transaction.linkedAmount ?? transactionBase(transaction, accounts, settings)), 0) >= goal.targetAmount;
	}).map((goal) => goal.name);
	const net = totalsCurrent.income - totalsCurrent.expenses;
	const recommendations: string[] = [];
	const highest = categoryChanges.find((item) => item.change > 0);
	if (highest) recommendations.push(`${highest.name} aumentó ${Math.round(highest.change)} frente al mes pasado.`);
	if (net < 0) recommendations.push('Cerraste con más gastos que ingresos: revisa tus compromisos del próximo mes.');
	else if (totalsCurrent.income > 0) recommendations.push(`Ahorraste ${Math.round((net / totalsCurrent.income) * 100)}% de tus ingresos este mes.`);
	if (subscriptionCount > 0) recommendations.push(`Tienes ${subscriptionCount} pago${subscriptionCount === 1 ? '' : 's'} recurrente${subscriptionCount === 1 ? '' : 's'} detectado${subscriptionCount === 1 ? '' : 's'} para revisar.`);
	return { month: start, income: totalsCurrent.income, expenses: totalsCurrent.expenses, net, savingsRate: totalsCurrent.income ? Math.round((net / totalsCurrent.income) * 100) : 0, incomeChange: percentage(totalsCurrent.income, totalsPrevious.income), expenseChange: percentage(totalsCurrent.expenses, totalsPrevious.expenses), categoryChanges, debtPaid, goalsContributed, completedGoals, subscriptionCount, recommendations };
}

export function buildNetWorthHistory(accounts: Account[], transactions: Transaction[], goals: Goal[], debts: Debt[], settings: Pick<Settings, 'baseCurrency' | 'exchangeRates'>, months = 6, date = new Date()): NetWorthPoint[] {
	const firstMonth = new Date(date.getFullYear(), date.getMonth() - months + 1, 1);
	return Array.from({ length: months }, (_, index) => {
		const month = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
		const cutoff = monthWindow(month).end;
		const balances = new Map(accounts.map((account) => [account.id, account.initialBalance ?? 0]));
		for (const transaction of transactions) {
			if ((transaction.timestamp ?? new Date(transaction.date).getTime()) > cutoff.getTime()) continue;
			if (transaction.type === 'income') balances.set(transaction.accountId, (balances.get(transaction.accountId) ?? 0) + transaction.amount);
			if (transaction.type === 'expense') balances.set(transaction.accountId, (balances.get(transaction.accountId) ?? 0) - transaction.amount);
			if (transaction.type === 'transfer' && transaction.toAccountId) { balances.set(transaction.accountId, (balances.get(transaction.accountId) ?? 0) - transaction.amount); balances.set(transaction.toAccountId, (balances.get(transaction.toAccountId) ?? 0) + (transaction.toAmount ?? transaction.amount)); }
		}
		const accountValue = accounts.reduce((sum, account) => sum + (balances.get(account.id) ?? 0) * getExchangeRateToBase(account.currency, settings), 0);
		const savings = goals.reduce((sum, goal) => sum + Math.min(goal.targetAmount, transactions.filter((transaction) => transaction.goalId === goal.id && (transaction.timestamp ?? new Date(transaction.date).getTime()) <= cutoff.getTime()).reduce((total, transaction) => total + (transaction.linkedAmount ?? transactionBase(transaction, accounts, settings)), 0)), 0);
		const position = debts.reduce((result, debt) => {
			const createdAt = debt.createdAt ? new Date(debt.createdAt) : new Date(date);
			if (createdAt > cutoff) return result;
			const paid = transactions.filter((transaction) => transaction.debtId === debt.id && (transaction.timestamp ?? new Date(transaction.date).getTime()) <= cutoff.getTime()).reduce((total, transaction) => total + (transaction.linkedAmount ?? transactionBase(transaction, accounts, settings)), 0);
			const remaining = Math.max(0, debt.totalAmount - paid);
			if (debt.type === 'i_owe') result.debts += remaining; else result.receivables += remaining;
			return result;
		}, { debts: 0, receivables: 0 });
		return { date: month, label: month.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }), accounts: accountValue, savings, receivables: position.receivables, debts: position.debts, netWorth: accountValue + savings + position.receivables - position.debts };
	});
}
