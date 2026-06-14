import { type Goal, GoalSchema } from '../schema';
import { loadFromStorage, saveToStorage } from './storage';

export class GoalsStore {
	data = $state<Goal[]>([]);
	isReady = $state(false);

	async init() {
		const stored = await loadFromStorage<any[]>('finances_goals', []);
		if (stored && stored.length > 0) {
			this.data = stored.filter(g => GoalSchema.safeParse(g).success);
		}
		this.isReady = true;
	}

	addGoal(goal: Goal) {
		this.data.push(goal);
		this.save();
	}

	deleteGoal(id: string) {
		this.data = this.data.filter((g) => g.id !== id);
		this.save();
	}

	updateGoalProgress(id: string, amount: number) {
		const goal = this.data.find((g) => g.id === id);
		if (goal) {
			goal.currentAmount += amount;
			this.save();
		}
	}

	save() {
		saveToStorage('finances_goals', $state.snapshot(this.data));
	}
}
