import { browser } from '$app/environment';
import { type Category, type Transaction, type Goal, defaultCategories } from './schema';

export type Period = 'all' | 'today' | 'week' | 'month' | 'year';

export class FinanceStore {
	categories = $state<Category[]>(defaultCategories);
	transactions = $state<Transaction[]>([]);
	goals = $state<Goal[]>([]);

	constructor() {
		if (browser) {
			const storedTransactions = localStorage.getItem('finances_transactions');
			const storedCategories = localStorage.getItem('finances_categories');
			const storedGoals = localStorage.getItem('finances_goals');

			if (storedTransactions) this.transactions = JSON.parse(storedTransactions);
			if (storedCategories) this.categories = JSON.parse(storedCategories);
			if (storedGoals) this.goals = JSON.parse(storedGoals);

			// Subscribe to changes to serialize to local storage
			$effect.root(() => {
				$effect(() => {
					localStorage.setItem('finances_transactions', JSON.stringify(this.transactions));
				});
				$effect(() => {
					localStorage.setItem('finances_categories', JSON.stringify(this.categories));
				});
				$effect(() => {
					localStorage.setItem('finances_goals', JSON.stringify(this.goals));
				});
			});
		}
	}

	addTransaction(transaction: Transaction) {
		this.transactions.push(transaction);
	}

	deleteTransaction(id: string) {
		this.transactions = this.transactions.filter((t) => t.id !== id);
	}

	addGoal(goal: Goal) {
		this.goals.push(goal);
	}

	deleteGoal(id: string) {
		this.goals = this.goals.filter((g) => g.id !== id);
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

		return {
			income,
			expenses,
			balance: income - expenses,
			savings
		};
	}

	/** Filtrar transacciones por período */
	getTransactionsByPeriod(period: Period): Transaction[] {
		const now = new Date();
		const start = new Date();

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
		const expenses = filtered.filter((t) => t.type === 'expense');

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

	/** Exportar datos como JSON */
	exportToJSON(): string {
		return JSON.stringify({
			transactions: this.transactions,
			categories: this.categories,
			goals: this.goals,
			exportedAt: new Date().toISOString()
		}, null, 2);
	}

	/** Importar datos desde JSON */
	importFromJSON(json: string): boolean {
		try {
			const data = JSON.parse(json);
			if (data.transactions) this.transactions = data.transactions;
			if (data.categories) this.categories = data.categories;
			if (data.goals) this.goals = data.goals;
			return true;
		} catch {
			return false;
		}
	}
}

export const financeStore = new FinanceStore();