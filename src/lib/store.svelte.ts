import { browser } from '$app/environment';
import { type Category, type Transaction, type Goal, defaultCategories, type Account, type Budget, type RecurringTransaction, type Debt, INTERNAL_CATEGORY_DEBT_PAYMENT, INTERNAL_CATEGORY_SAVINGS, TransactionSchema, CategorySchema, GoalSchema, AccountSchema, BudgetSchema, RecurringTransactionSchema, DebtSchema } from './schema';
import { toastStore } from './toast.svelte';

export type Period = 'all' | 'today' | 'week' | 'month' | 'year' | string;

export class FinanceStore {
	categories = $state<Category[]>(defaultCategories);
	transactions = $state<Transaction[]>([]);
	goals = $state<Goal[]>([]);
	accounts = $state<Account[]>([{ id: 'default-cash', name: 'Efectivo General', type: 'cash', balance: 0, color: 'bg-green-500' }]);
	budgets = $state<Budget[]>([]);
	recurringTransactions = $state<RecurringTransaction[]>([]);
	debts = $state<Debt[]>([]);

	constructor() {
		if (browser) {
			const storedTransactions = localStorage.getItem('finances_transactions');
			const storedCategories = localStorage.getItem('finances_categories');
			const storedGoals = localStorage.getItem('finances_goals');
			const storedAccounts = localStorage.getItem('finances_accounts');
			const storedBudgets = localStorage.getItem('finances_budgets');
			const storedRecurring = localStorage.getItem('finances_recurring');
			const storedDebts = localStorage.getItem('finances_debts');

			try {
				if (storedCategories) {
					const parsed: Category[] = JSON.parse(storedCategories);
					const valid = parsed.filter(c => CategorySchema.safeParse(c).success);
					// Fusionar con las categorías internas del sistema para que nunca se pierdan
					const internalIds = [INTERNAL_CATEGORY_DEBT_PAYMENT, INTERNAL_CATEGORY_SAVINGS];
					const internalCats = defaultCategories.filter(c => internalIds.includes(c.id));
					const userCats = valid.filter(c => !internalIds.includes(c.id));
					this.categories = [...userCats, ...internalCats];
				}
			} catch (e) { console.error('Error parseando categories', e); }

			try {
				if (storedGoals) this.goals = JSON.parse(storedGoals).filter((g: any) => GoalSchema.safeParse(g).success);
			} catch (e) { console.error('Error parseando goals', e); }

			try {
				if (storedAccounts) {
					const parsed = JSON.parse(storedAccounts).filter((a: any) => AccountSchema.safeParse(a).success);
					if (parsed.length > 0) this.accounts = parsed;
				}
			} catch (e) { console.error('Error parseando accounts', e); }

			try {
				if (storedBudgets) this.budgets = JSON.parse(storedBudgets).filter((b: any) => BudgetSchema.safeParse(b).success);
			} catch (e) { console.error('Error parseando budgets', e); }

			try {
				if (storedRecurring) this.recurringTransactions = JSON.parse(storedRecurring).filter((r: any) => RecurringTransactionSchema.safeParse(r).success);
			} catch (e) { console.error('Error parseando recurring', e); }

			try {
				if (storedDebts) this.debts = JSON.parse(storedDebts).filter((d: any) => DebtSchema.safeParse(d).success);
			} catch (e) { console.error('Error parseando debts', e); }

			try {
				if (storedTransactions) {
					const parsedTx = JSON.parse(storedTransactions);
					this.transactions = parsedTx.map((t: any) => ({
						...t,
						accountId: t.accountId || 'default-cash'
					})).filter((t: any) => TransactionSchema.safeParse(t).success);
				}
			} catch (e) { console.error('Error parseando transactions', e); }

			this.recalculateBalances();
			this.processRecurringTransactions();

			// Subscribe to changes to serialize to local storage
			$effect.root(() => {
				$effect(() => { localStorage.setItem('finances_transactions', JSON.stringify(this.transactions)); });
				$effect(() => { localStorage.setItem('finances_categories', JSON.stringify(this.categories)); });
				$effect(() => { localStorage.setItem('finances_goals', JSON.stringify(this.goals)); });
				$effect(() => { localStorage.setItem('finances_accounts', JSON.stringify(this.accounts)); });
				$effect(() => { localStorage.setItem('finances_budgets', JSON.stringify(this.budgets)); });
				$effect(() => { localStorage.setItem('finances_recurring', JSON.stringify(this.recurringTransactions)); });
				$effect(() => { localStorage.setItem('finances_debts', JSON.stringify(this.debts)); });
			});
		}
	}

	recalculateBalances() {
		const balances: Record<string, number> = {};
		this.accounts.forEach(a => balances[a.id] = 0);

		this.transactions.forEach(t => {
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

		this.accounts = this.accounts.map(a => ({ ...a, balance: balances[a.id] || 0 }));
	}

	processRecurringTransactions() {
		const now = new Date();
		let addedNew = false;

		this.recurringTransactions = this.recurringTransactions.map(rt => {
			let nextDate = new Date(rt.nextDate);
			while (nextDate <= now) {
				this.transactions.push({
					id: crypto.randomUUID(),
					date: nextDate.toISOString(),
					amount: rt.amount,
					categoryId: rt.categoryId,
					accountId: rt.accountId,
					toAccountId: rt.toAccountId,
					note: rt.note,
					type: rt.type
				});
				addedNew = true;
				
				if (rt.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
				else if (rt.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
				else if (rt.frequency === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
				else if (rt.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
			}
			return { ...rt, nextDate: nextDate.toISOString() };
		});

		if (addedNew) this.recalculateBalances();
	}

	addTransaction(transaction: Transaction) {
		this.transactions.push(transaction);
		this.recalculateBalances();
	}

	deleteTransaction(id: string) {
		this.transactions = this.transactions.filter((t) => t.id !== id);
		this.recalculateBalances();
	}

	updateTransaction(id: string, data: Partial<Transaction>) {
		const index = this.transactions.findIndex((t) => t.id === id);
		if (index !== -1) {
			this.transactions[index] = { ...this.transactions[index], ...data };
			this.recalculateBalances();
		}
	}

	addAccount(account: Account) {
		this.accounts.push(account);
	}

	deleteAccount(id: string) {
		const hasTx = this.transactions.some(t => t.accountId === id || t.toAccountId === id);
		if (hasTx) {
			toastStore.add('No se puede eliminar la cuenta porque tiene transacciones asociadas.', 'error');
			return false;
		}
		this.accounts = this.accounts.filter(a => a.id !== id);
		return true;
	}

	addBudget(budget: Budget) {
		this.budgets.push(budget);
	}

	deleteBudget(id: string) {
		this.budgets = this.budgets.filter(b => b.id !== id);
	}

	addRecurringTransaction(rt: RecurringTransaction) {
		this.recurringTransactions.push(rt);
	}

	deleteRecurringTransaction(id: string) {
		this.recurringTransactions = this.recurringTransactions.filter(rt => rt.id !== id);
	}

	getBudgetProgress(categoryId: string) {
		const budget = this.budgets.find(b => b.categoryId === categoryId);
		if (!budget) return null;

		const now = new Date();
		const currentMonth = now.getMonth();
		const currentYear = now.getFullYear();

		const spent = this.transactions
			.filter(t => t.type === 'expense' && t.categoryId === categoryId)
			.filter(t => {
				const d = new Date(t.date);
				return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
			})
			.reduce((acc, t) => acc + t.amount, 0);

		return {
			budget: budget.amount,
			spent,
			percent: Math.round((spent / budget.amount) * 100)
		};
	}

	addDebt(debt: Debt) {
		this.debts.push(debt);
	}

	deleteDebt(id: string) {
		this.debts = this.debts.filter(d => d.id !== id);
	}

	payDebt(debtId: string, amount: number, accountId: string) {
		const debt = this.debts.find(d => d.id === debtId);
		if (!debt) return;

		// Actualizar progreso de la deuda
		debt.paidAmount += amount;
		if (debt.paidAmount >= debt.totalAmount) {
			debt.paidAmount = debt.totalAmount;
			debt.status = 'paid';
		}

		// Crear transacción real usando categorías internas del sistema
		// Si es 'i_owe' (yo debo), pagar es un gasto.
		// Si es 'owed_to_me' (me deben), recibir el pago es un ingreso.
		const isExpense = debt.type === 'i_owe';

		const newTx: Transaction = {
			id: crypto.randomUUID(),
			date: new Date().toISOString(),
			amount: amount,
			categoryId: INTERNAL_CATEGORY_DEBT_PAYMENT,
			accountId: accountId,
			note: `Abono a deuda: ${debt.contactName}`,
			type: isExpense ? 'expense' : 'income'
		};

		this.addTransaction(newTx);
	}

	addGoal(goal: Goal) {
		this.goals.push(goal);
	}

	deleteGoal(id: string) {
		this.goals = this.goals.filter((g) => g.id !== id);
	}

	deleteCategory(id: string) {
		const hasTx = this.transactions.some(t => t.categoryId === id);
		if (hasTx) {
			toastStore.add('No se puede eliminar la categoría porque tiene transacciones asociadas.', 'error');
			return false;
		}
		this.categories = this.categories.filter((c) => c.id !== id);
		return true;
	}

	updateGoalProgress(id: string, amount: number) {
		const goal = this.goals.find((g) => g.id === id);
		if (goal) {
			goal.currentAmount += amount;
		}
	}

	get summary() {
		const income = this.transactions
			.filter((t) => t.type === 'income')
			.reduce((acc, t) => acc + t.amount, 0);

		const expenses = this.transactions
			.filter((t) => t.type === 'expense')
			.reduce((acc, t) => acc + t.amount, 0);

		const savings = this.goals.reduce((acc, g) => acc + g.currentAmount, 0);
		
		const balance = this.accounts.reduce((acc, a) => acc + a.balance, 0);

		return {
			income,
			expenses,
			balance,
			savings
		};
	}

	/** Filtrar transacciones por período */
	getTransactionsByPeriod(period: Period): Transaction[] {
		const now = new Date();
		const start = new Date();

		if (typeof period === 'string' && period.includes('-')) {
			const [year, month] = period.split('-').map(Number);
			return this.transactions.filter((t) => {
				const d = new Date(t.date);
				return d.getFullYear() === year && d.getMonth() + 1 === month;
			});
		}

		switch (period) {
			case 'today':
				start.setHours(0, 0, 0, 0);
				break;
			case 'week':
				start.setDate(start.getDate() - 7);
				break;
			case 'month':
				start.setMonth(start.getMonth() - 1);
				break;
			case 'year':
				start.setFullYear(start.getFullYear() - 1);
				break;
			default:
				return [...this.transactions];
		}

		return this.transactions.filter((t) => new Date(t.date) >= start && new Date(t.date) <= now);
	}

	/** Agrupar gastos por categoría para gráficos */
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

	/** Datos para gráfico de evolución semanal */
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

	/** Datos para gráfico de barras mensual */
	getMonthlyComparison() {
		const months: { label: string; expenses: number; income: number }[] = [];

		for (let i = 5; i >= 0; i--) {
			const d = new Date();
			d.setMonth(d.getMonth() - i);
			const month = d.getMonth();
			const year = d.getFullYear();

			const monthTx = this.transactions.filter((t) => {
				const td = new Date(t.date);
				return td.getMonth() === month && td.getFullYear() === year;
			});

			const expenses = monthTx.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
			const income = monthTx.filter((t) => t.type === 'income').reduce((a, b) => a + b.amount, 0);

			const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
			months.push({ label: names[month], expenses, income });
		}

		return months;
	}

	/** Obtener la categoría con mayor gasto */
	getTopCategory(period: Period = 'all'): { name: string; amount: number; percent: number } | null {
		const byCat = this.getExpensesByCategory(period);
		if (byCat.length === 0) return null;
		return byCat[0];
	}

	/** Comparar gasto de esta semana vs la anterior */
	getWeekComparison(): { current: number; previous: number; diff: number; diffPercent: number } {
		const now = new Date();
		
		// Semana actual: últimos 7 días
		const weekStart = new Date(now);
		weekStart.setDate(weekStart.getDate() - 7);

		// Semana anterior: 7-14 días atrás
		const prevStart = new Date(now);
		prevStart.setDate(prevStart.getDate() - 14);

		const current = this.transactions
			.filter((t) => t.type === 'expense' && new Date(t.date) >= weekStart)
			.reduce((a, b) => a + b.amount, 0);

		const previous = this.transactions
			.filter((t) => t.type === 'expense' && new Date(t.date) >= prevStart && new Date(t.date) < weekStart)
			.reduce((a, b) => a + b.amount, 0);

		const diff = current - previous;
		const diffPercent = previous > 0 ? Math.round((diff / previous) * 100) : (current > 0 ? 100 : 0);

		return { current, previous, diff, diffPercent };
	}

	/** Indicadores de salud financiera del mes actual */
	getMonthlyHealthMetrics() {
		const now = new Date();
		const month = now.getMonth();
		const year = now.getFullYear();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const dayOfMonth = now.getDate();
		const daysLeft = daysInMonth - dayOfMonth;

		const monthTx = this.transactions.filter(t => {
			const d = new Date(t.date);
			return d.getMonth() === month && d.getFullYear() === year;
		});

		const monthIncome = monthTx.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
		const monthExpenses = monthTx.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
		const monthNet = monthIncome - monthExpenses;

		// Tasa de ahorro: (ingresos - gastos) / ingresos * 100
		const savingsRate = monthIncome > 0 ? Math.round((monthNet / monthIncome) * 100) : 0;

		// Proyección al final del mes basada en el ritmo diario de gastos
		const dailyBurnRate = dayOfMonth > 0 ? monthExpenses / dayOfMonth : 0;
		const projectedExpenses = dailyBurnRate * daysInMonth;
		const projectedNet = monthIncome - projectedExpenses;

		// Promedio diario disponible para los días restantes
		const dailyBudgetLeft = daysLeft > 0 ? monthNet / daysLeft : 0;

		return {
			monthIncome,
			monthExpenses,
			monthNet,
			savingsRate,
			projectedExpenses,
			projectedNet,
			dailyBudgetLeft,
			daysLeft,
			dayOfMonth
		};
	}

	/** Deudas vencidas (dueDate pasada y pendientes) */
	getOverdueDebts() {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return this.debts.filter(d =>
			d.status === 'pending' &&
			d.dueDate &&
			new Date(d.dueDate) < today
		);
	}

	/** Exportar datos como JSON (backup completo) */
	exportToJSON(): string {
		return JSON.stringify({
			transactions: this.transactions,
			categories: this.categories,
			goals: this.goals,
			accounts: this.accounts,
			budgets: this.budgets,
			recurringTransactions: this.recurringTransactions,
			debts: this.debts,
			exportedAt: new Date().toISOString()
		}, null, 2);
	}

	/** Importar datos desde JSON con validación Zod */
	importFromJSON(json: string): boolean {
		try {
			const data = JSON.parse(json);

			if (data.transactions && Array.isArray(data.transactions)) {
				const parsed = data.transactions.map((t: unknown) => TransactionSchema.parse(t));
				this.transactions = parsed;
			}
			if (data.categories && Array.isArray(data.categories)) {
				const parsed = data.categories.map((c: unknown) => CategorySchema.parse(c));
				// Preservar siempre las categorías internas del sistema
				const internalIds = [INTERNAL_CATEGORY_DEBT_PAYMENT, INTERNAL_CATEGORY_SAVINGS];
				const internalCats = defaultCategories.filter(c => internalIds.includes(c.id));
				const userCats = parsed.filter((c: Category) => !internalIds.includes(c.id));
				this.categories = [...userCats, ...internalCats];
			}
			if (data.goals && Array.isArray(data.goals)) {
				this.goals = data.goals.map((g: unknown) => GoalSchema.parse(g));
			}
			if (data.accounts && Array.isArray(data.accounts)) {
				this.accounts = data.accounts.map((a: unknown) => AccountSchema.parse(a));
			}
			if (data.budgets && Array.isArray(data.budgets)) {
				this.budgets = data.budgets.map((b: unknown) => BudgetSchema.parse(b));
			}
			if (data.recurringTransactions && Array.isArray(data.recurringTransactions)) {
				this.recurringTransactions = data.recurringTransactions.map((r: unknown) => RecurringTransactionSchema.parse(r));
			}
			if (data.debts && Array.isArray(data.debts)) {
				this.debts = data.debts.map((d: unknown) => DebtSchema.parse(d));
			}

			this.recalculateBalances();
			return true;
		} catch {
			return false;
		}
	}
}

export const financeStore = new FinanceStore();