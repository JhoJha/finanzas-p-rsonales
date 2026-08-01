import type { Account, Budget, Category, Goal, Settings, Transaction } from '$lib/schema';
import { getExchangeRateToBase } from '$lib/utils/finance';

export type ReportPeriod = 'all' | 'today' | 'week' | 'month' | 'year' | string;
export type AmountInBase = (transaction: Transaction) => number;

type ReportData = {
	accounts: Account[];
	budgets: Budget[];
	categories: Category[];
	goals: Goal[];
	settings: Settings;
	transactions: Transaction[];
};

/** Consultas financieras puras; no modifican el estado ni la persistencia. */
export class ReportsService {
	static budgetProgress(data: ReportData, identifier: string, amountInBase: AmountInBase, now = new Date()) {
		const budget = data.budgets.find((item) => item.id === identifier)
			?? data.budgets.find((item) => item.categoryId === identifier && item.period === 'monthly');
		if (!budget) return null;

		const startDate = budget.period === 'weekly'
			? new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
			: new Date(now.getFullYear(), now.getMonth(), 1);
		const endDate = budget.period === 'weekly'
			? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6, 23, 59, 59, 999)
			: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
		const previousStart = budget.period === 'weekly'
			? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - 7)
			: new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const previousEnd = new Date(startDate.getTime() - 1);
		const sumExpenses = (from: number, to: number) => data.transactions
			.filter((transaction) => transaction.type === 'expense' && transaction.categoryId === budget.categoryId && transaction.timestamp! >= from && transaction.timestamp! <= to)
			.reduce((sum, transaction) => sum + amountInBase(transaction), 0);
		const spent = sumExpenses(startDate.getTime(), endDate.getTime());
		const previousSpent = sumExpenses(previousStart.getTime(), previousEnd.getTime());
		const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86400000));
		const available = budget.amount - spent;

		return {
			id: budget.id, period: budget.period, budget: budget.amount, spent, previousSpent, available, daysLeft,
			dailyAvailable: daysLeft > 0 ? Math.max(0, available) / daysLeft : Math.max(0, available),
			percent: Math.round((spent / budget.amount) * 100),
			alertThreshold: budget.alertThreshold ?? data.settings.budgetAlertThreshold
		};
	}

	static budgetAlerts(data: ReportData, amountInBase: AmountInBase, now = new Date()) {
		return data.budgets.flatMap((budget) => {
			const progress = this.budgetProgress(data, budget.id, amountInBase, now);
			return progress && progress.percent >= progress.alertThreshold ? [{ budget, progress }] : [];
		});
	}

	static summary(data: ReportData, amountInBase: AmountInBase) {
		let income = 0;
		let expenses = 0;
		data.transactions.forEach((transaction) => {
			const amount = amountInBase(transaction);
			if (transaction.type === 'income') income += amount;
			if (transaction.type === 'expense') expenses += amount;
		});
		return {
			income,
			expenses,
			balance: data.accounts.reduce((sum, account) => sum + account.balance * getExchangeRateToBase(account.currency, data.settings), 0),
			savings: data.goals.reduce((sum, goal) => sum + goal.currentAmount, 0)
		};
	}

	static transactionsByPeriod(transactions: Transaction[], period: ReportPeriod, now = new Date()): Transaction[] {
		const current = now.getTime();
		if (period.includes('-')) {
			const [year, month] = period.split('-').map(Number);
			const from = new Date(year, month - 1, 1).getTime();
			const to = new Date(year, month, 0, 23, 59, 59, 999).getTime();
			return transactions.filter((transaction) => transaction.timestamp! >= from && transaction.timestamp! <= to);
		}
		const from = new Date(now);
		switch (period) {
			case 'today': from.setHours(0, 0, 0, 0); break;
			case 'week': from.setDate(from.getDate() - 7); break;
			case 'month': from.setMonth(from.getMonth() - 1); break;
			case 'year': from.setFullYear(from.getFullYear() - 1); break;
			default: return [...transactions];
		}
		return transactions.filter((transaction) => transaction.timestamp! >= from.getTime() && transaction.timestamp! <= current);
	}

	static expensesByCategory(data: ReportData, amountInBase: AmountInBase, period: ReportPeriod = 'all') {
		const transactions = period === 'all' ? data.transactions : this.transactionsByPeriod(data.transactions, period);
		const grouped: Record<string, number> = {};
		transactions.filter((transaction) => transaction.type === 'expense' && transaction.categoryId !== 'transfer').forEach((transaction) => {
			grouped[transaction.categoryId] = (grouped[transaction.categoryId] || 0) + amountInBase(transaction);
		});
		const total = Object.values(grouped).reduce((sum, amount) => sum + amount, 0) || 1;
		return Object.entries(grouped).map(([id, amount]) => {
			const category = data.categories.find((item) => item.id === id);
			return { id, name: category?.name || 'Otro', amount, color: category?.color?.replace('bg-', '') || 'gray-500', percent: Math.round((amount / total) * 100) };
		}).sort((a, b) => b.amount - a.amount);
	}
}
