import { type Category, type Transaction, type Goal, type Account, type Budget, type RecurringTransaction, type Debt, INTERNAL_CATEGORY_DEBT_PAYMENT, INTERNAL_CATEGORY_SAVINGS, TransactionSchema, CategorySchema, GoalSchema, AccountSchema, BudgetSchema, RecurringTransactionSchema, DebtSchema } from './schema';
import { toastStore } from './toast.svelte';
import { browser } from '$app/environment';

import { AccountsStore } from './stores/accounts.svelte';
import { TransactionsStore } from './stores/transactions.svelte';
import { CategoriesStore } from './stores/categories.svelte';
import { GoalsStore } from './stores/goals.svelte';
import { BudgetsStore } from './stores/budgets.svelte';
import { DebtsStore } from './stores/debts.svelte';
import { RecurringStore } from './stores/recurring.svelte';

export type Period = 'all' | 'today' | 'week' | 'month' | 'year' | string;

class FinanceStoreFacade {
	private accountsStore = new AccountsStore();
	private transactionsStore = new TransactionsStore();
	private categoriesStore = new CategoriesStore();
	private goalsStore = new GoalsStore();
	private budgetsStore = new BudgetsStore();
	private debtsStore = new DebtsStore();
	private recurringStore = new RecurringStore();

	isReady = $state(false);

	constructor() {
		if (browser) {
			this.initAll();
		}
	}

	async initAll() {
		await Promise.all([
			this.accountsStore.init(),
			this.transactionsStore.init(),
			this.categoriesStore.init(),
			this.goalsStore.init(),
			this.budgetsStore.init(),
			this.debtsStore.init(),
			this.recurringStore.init()
		]);
		this.processRecurringTransactions();
		this.isReady = true;
	}

	// === Derived State Accessors ===
	get categories() { return this.categoriesStore.data; }
	get transactions() { return this.transactionsStore.data; }
	get goals() { return this.goalsStore.data; }
	get budgets() { return this.budgetsStore.data; }
	get recurringTransactions() { return this.recurringStore.data; }
	get debts() { return this.debtsStore.data; }

	// Accounts Balance Reactivity with $derived
	accounts = $derived.by(() => {
		const balances: Record<string, number> = {};
		this.accountsStore.data.forEach(a => balances[a.id] = 0);

		this.transactionsStore.data.forEach(t => {
			if (!balances[t.accountId]) balances[t.accountId] = 0;
			
			if (t.type === 'income') {
				balances[t.accountId] += t.amount;
			} else if (t.type === 'expense') {
				balances[t.accountId] -= t.amount;
			} else if (t.type === 'transfer' && t.toAccountId) {
				balances[t.accountId] -= t.amount;
				if (!balances[t.toAccountId]) balances[t.toAccountId] = 0;
				balances[t.toAccountId] += t.amount;
			}
		});

		return this.accountsStore.data.map(a => ({
			...a,
			balance: balances[a.id] || 0
		}));
	});

	// === Transactions ===
	addTransaction(transaction: Transaction) {
		this.transactionsStore.addTransaction(transaction);
	}
	deleteTransaction(id: string) {
		this.transactionsStore.deleteTransaction(id);
	}
	updateTransaction(id: string, data: Partial<Transaction>) {
		this.transactionsStore.updateTransaction(id, data);
	}

	// === Accounts ===
	addAccount(account: Account) {
		this.accountsStore.addAccount(account);
	}
	deleteAccount(id: string) {
		const hasTx = this.transactions.some(t => t.accountId === id || t.toAccountId === id);
		if (hasTx) {
			toastStore.add('No se puede eliminar la cuenta porque tiene transacciones asociadas.', 'error');
			return false;
		}
		this.accountsStore.removeAccount(id);
		return true;
	}

	// === Categories ===
	deleteCategory(id: string) {
		const hasTx = this.transactions.some(t => t.categoryId === id);
		if (hasTx) {
			toastStore.add('No se puede eliminar la categoría porque tiene transacciones asociadas.', 'error');
			return false;
		}
		this.categoriesStore.removeCategory(id);
		return true;
	}

	// === Goals ===
	addGoal(goal: Goal) { this.goalsStore.addGoal(goal); }
	deleteGoal(id: string) { this.goalsStore.deleteGoal(id); }
	updateGoalProgress(id: string, amount: number) { this.goalsStore.updateGoalProgress(id, amount); }

	// === Budgets ===
	addBudget(budget: Budget) { this.budgetsStore.addBudget(budget); }
	deleteBudget(id: string) { this.budgetsStore.deleteBudget(id); }
	
	getBudgetProgress(categoryId: string) {
		const budget = this.budgets.find(b => b.categoryId === categoryId);
		if (!budget) return null;

		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

		const spent = this.transactions
			.filter(t => t.type === 'expense' && t.categoryId === categoryId && t.timestamp! >= startOfMonth && t.timestamp! <= endOfMonth)
			.reduce((acc, t) => acc + t.amount, 0);

		return {
			budget: budget.amount,
			spent,
			percent: Math.round((spent / budget.amount) * 100)
		};
	}

	// === Recurring ===
	addRecurringTransaction(rt: RecurringTransaction) { this.recurringStore.addRecurringTransaction(rt); }
	deleteRecurringTransaction(id: string) { this.recurringStore.deleteRecurringTransaction(id); }
	
	processRecurringTransactions() {
		const now = new Date();
		const updatedRecurring = this.recurringTransactions.map(rt => {
			let nextDate = new Date(rt.nextDate);
			while (nextDate <= now) {
				this.addTransaction({
					id: crypto.randomUUID(),
					date: nextDate.toISOString(),
					amount: rt.amount,
					categoryId: rt.categoryId,
					accountId: rt.accountId,
					toAccountId: rt.toAccountId,
					note: rt.note,
					type: rt.type
				});
				
				if (rt.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
				else if (rt.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
				else if (rt.frequency === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
				else if (rt.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
			}
			return { ...rt, nextDate: nextDate.toISOString() };
		});
		this.recurringStore.updateRecurringTransactions(updatedRecurring);
	}

	// === Debts ===
	addDebt(debt: Debt) { this.debtsStore.addDebt(debt); }
	deleteDebt(id: string) { this.debtsStore.deleteDebt(id); }
	
	payDebt(debtId: string, amount: number, accountId: string) {
		this.debtsStore.updateDebt(debtId, (debt) => {
			debt.paidAmount += amount;
			if (debt.paidAmount >= debt.totalAmount) {
				debt.paidAmount = debt.totalAmount;
				debt.status = 'paid';
			}

			const isExpense = debt.type === 'i_owe';
			this.addTransaction({
				id: crypto.randomUUID(),
				date: new Date().toISOString(),
				amount: amount,
				categoryId: INTERNAL_CATEGORY_DEBT_PAYMENT,
				accountId: accountId,
				note: `Abono a deuda: ${debt.contactName}`,
				type: isExpense ? 'expense' : 'income'
			});
		});
	}
	
	getOverdueDebts() {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return this.debts.filter(d =>
			d.status === 'pending' &&
			d.dueDate &&
			new Date(d.dueDate) < today
		);
	}

	// === Derived Summaries & Health ===
	get summary() {
		const income = this.transactions
			.filter((t) => t.type === 'income')
			.reduce((acc, t) => acc + t.amount, 0);

		const expenses = this.transactions
			.filter((t) => t.type === 'expense')
			.reduce((acc, t) => acc + t.amount, 0);

		const savings = this.goals.reduce((acc, g) => acc + g.currentAmount, 0);
		
		const balance = this.accounts.reduce((acc, a) => acc + a.balance, 0);

		return { income, expenses, balance, savings };
	}

	getTransactionsByPeriod(period: Period): Transaction[] {
		const now = Date.now();
		let start = 0;

		if (typeof period === 'string' && period.includes('-')) {
			const [year, month] = period.split('-').map(Number);
			const startOfMonth = new Date(year, month - 1, 1).getTime();
			const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();
			return this.transactions.filter((t) => t.timestamp! >= startOfMonth && t.timestamp! <= endOfMonth);
		}

		const d = new Date();
		switch (period) {
			case 'today':
				d.setHours(0, 0, 0, 0);
				start = d.getTime();
				break;
			case 'week':
				d.setDate(d.getDate() - 7);
				start = d.getTime();
				break;
			case 'month':
				d.setMonth(d.getMonth() - 1);
				start = d.getTime();
				break;
			case 'year':
				d.setFullYear(d.getFullYear() - 1);
				start = d.getTime();
				break;
			default:
				return [...this.transactions];
		}

		return this.transactions.filter((t) => t.timestamp! >= start && t.timestamp! <= now);
	}

	getExpensesByCategory(period: Period = 'all') {
		const filtered = period === 'all' ? this.transactions : this.getTransactionsByPeriod(period);
		const expenses = filtered.filter((t) => t.type === 'expense' && t.categoryId !== 'transfer');

		const grouped: Record<string, number> = {};
		expenses.forEach((t) => {
			grouped[t.categoryId] = (grouped[t.categoryId] || 0) + t.amount;
		});

		const total = Object.values(grouped).reduce((a, b) => a + b, 0) || 1;

		return Object.entries(grouped)
			.map(([id, amount]) => {
				const cat = this.categories.find((c) => c.id === id);
				return {
					id,
					name: cat?.name || 'Otro',
					amount,
					color: cat?.color?.replace('bg-', '') || 'gray-500',
					percent: Math.round((amount / total) * 100)
				};
			})
			.sort((a, b) => b.amount - a.amount);
	}

	getWeeklyEvolution() {
		const now = new Date();
		const days: { label: string; expenses: number; income: number }[] = [];

		for (let i = 6; i >= 0; i--) {
			const d = new Date(now);
			d.setDate(d.getDate() - i);
			const dayStr = d.toISOString().split('T')[0];

			const dayTx = this.transactions.filter((t) => t.date.startsWith(dayStr));
			const expenses = dayTx.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
			const income = dayTx.filter((t) => t.type === 'income').reduce((a, b) => a + b.amount, 0);

			const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
			days.push({ label: names[d.getDay()], expenses, income });
		}

		return days;
	}

	getMonthlyComparison() {
		const months: { label: string; expenses: number; income: number }[] = [];

		for (let i = 5; i >= 0; i--) {
			const d = new Date();
			d.setMonth(d.getMonth() - i);
			const month = d.getMonth();
			const year = d.getFullYear();

			const startOfMonth = new Date(year, month, 1).getTime();
			const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

			const monthTx = this.transactions.filter((t) => t.timestamp! >= startOfMonth && t.timestamp! <= endOfMonth);

			const expenses = monthTx.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
			const income = monthTx.filter((t) => t.type === 'income').reduce((a, b) => a + b.amount, 0);

			const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
			months.push({ label: names[month], expenses, income });
		}

		return months;
	}

	getTopCategory(period: Period = 'all') {
		const byCat = this.getExpensesByCategory(period);
		if (byCat.length === 0) return null;
		return byCat[0];
	}

	getWeekComparison() {
		const now = new Date();
		const weekStart = new Date(now);
		weekStart.setDate(weekStart.getDate() - 7);
		const weekStartTs = weekStart.getTime();
		
		const prevStart = new Date(now);
		prevStart.setDate(prevStart.getDate() - 14);
		const prevStartTs = prevStart.getTime();

		const current = this.transactions
			.filter((t) => t.type === 'expense' && t.timestamp! >= weekStartTs)
			.reduce((a, b) => a + b.amount, 0);

		const previous = this.transactions
			.filter((t) => t.type === 'expense' && t.timestamp! >= prevStartTs && t.timestamp! < weekStartTs)
			.reduce((a, b) => a + b.amount, 0);

		const diff = current - previous;
		const diffPercent = previous > 0 ? Math.round((diff / previous) * 100) : (current > 0 ? 100 : 0);

		return { current, previous, diff, diffPercent };
	}

	getMonthlyHealthMetrics() {
		const now = new Date();
		const month = now.getMonth();
		const year = now.getFullYear();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const dayOfMonth = now.getDate();
		const daysLeft = daysInMonth - dayOfMonth;

		const startOfMonth = new Date(year, month, 1).getTime();
		const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

		const monthTx = this.transactions.filter(t => t.timestamp! >= startOfMonth && t.timestamp! <= endOfMonth);

		const monthIncome = monthTx.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
		const monthExpenses = monthTx.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
		const monthNet = monthIncome - monthExpenses;

		const savingsRate = monthIncome > 0 ? Math.round((monthNet / monthIncome) * 100) : 0;
		const dailyBurnRate = dayOfMonth > 0 ? monthExpenses / dayOfMonth : 0;
		const projectedExpenses = dailyBurnRate * daysInMonth;
		const projectedNet = monthIncome - projectedExpenses;
		const dailyBudgetLeft = daysLeft > 0 ? monthNet / daysLeft : 0;

		return {
			monthIncome, monthExpenses, monthNet, savingsRate,
			projectedExpenses, projectedNet, dailyBudgetLeft, daysLeft, dayOfMonth
		};
	}

	exportToJSON(): string {
		return JSON.stringify({
			transactions: this.transactions,
			categories: this.categories,
			goals: this.goals,
			accounts: this.accountsStore.data, // base without derived balance to prevent cyclic issues? Wait, we can export derived. But this is fine for now.
			budgets: this.budgets,
			recurringTransactions: this.recurringTransactions,
			debts: this.debts,
			exportedAt: new Date().toISOString()
		}, null, 2);
	}

	importFromJSON(json: string): boolean {
		try {
			const data = JSON.parse(json);
			// We can implement full import by clearing and pushing to stores, 
			// but for this refactor, let's keep it simple or implement it properly:
			if (data.transactions) {
				this.transactionsStore.data = data.transactions.map((t: unknown) => TransactionSchema.parse(t));
				this.transactionsStore.save();
			}
			if (data.categories) {
				const internalIds = [INTERNAL_CATEGORY_DEBT_PAYMENT, INTERNAL_CATEGORY_SAVINGS];
				const parsed = data.categories.filter((c: any) => CategorySchema.safeParse(c).success);
				// Enforce internals
				this.categoriesStore.data = parsed;
				this.categoriesStore.save();
			}
			if (data.accounts) {
				this.accountsStore.data = data.accounts.map((a: unknown) => AccountSchema.parse(a));
				this.accountsStore.save();
			}
			if (data.goals) {
				this.goalsStore.data = data.goals.map((g: unknown) => GoalSchema.parse(g));
				this.goalsStore.save();
			}
			if (data.budgets) {
				this.budgetsStore.data = data.budgets.map((b: unknown) => BudgetSchema.parse(b));
				this.budgetsStore.save();
			}
			if (data.debts) {
				this.debtsStore.data = data.debts.map((d: unknown) => DebtSchema.parse(d));
				this.debtsStore.save();
			}
			if (data.recurringTransactions) {
				this.recurringStore.data = data.recurringTransactions.map((r: unknown) => RecurringTransactionSchema.parse(r));
				this.recurringStore.save();
			}
			return true;
		} catch {
			return false;
		}
	}
}

export const financeStore = new FinanceStoreFacade();