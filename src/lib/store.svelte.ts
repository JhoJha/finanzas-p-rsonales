import { browser } from '$app/environment';
import { type Category, type Transaction, type Goal, defaultCategories } from './schema';

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
}

export const financeStore = new FinanceStore();