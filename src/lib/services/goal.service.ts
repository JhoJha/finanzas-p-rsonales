import type { Goal, Transaction } from '$lib/schema';

export class GoalService {
	static applyContribution(goals: Goal[], transaction: Transaction, multiplier: number): Goal[] {
		if (!transaction.goalId) return goals;
		const amount = (transaction.linkedAmount ?? transaction.amount) * multiplier;
		return goals.map((goal) => goal.id === transaction.goalId
			? { ...goal, currentAmount: Math.max(0, goal.currentAmount + amount) }
			: goal);
	}
}
