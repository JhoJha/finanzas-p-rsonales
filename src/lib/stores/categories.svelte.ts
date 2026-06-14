import { type Category, CategorySchema, defaultCategories, INTERNAL_CATEGORY_DEBT_PAYMENT, INTERNAL_CATEGORY_SAVINGS } from '../schema';
import { loadFromStorage, saveToStorage } from './storage';

export class CategoriesStore {
	data = $state<Category[]>(defaultCategories);
	isReady = $state(false);

	async init() {
		const stored = await loadFromStorage<any[]>('finances_categories', []);
		if (stored && stored.length > 0) {
			const valid = stored.filter(c => CategorySchema.safeParse(c).success);
			const internalIds = [INTERNAL_CATEGORY_DEBT_PAYMENT, INTERNAL_CATEGORY_SAVINGS];
			const internalCats = defaultCategories.filter(c => internalIds.includes(c.id));
			const userCats = valid.filter(c => !internalIds.includes(c.id));
			this.data = [...userCats, ...internalCats];
		}
		this.isReady = true;
	}

	addCategory(category: Category) {
		this.data.push(category);
		this.save();
	}

	removeCategory(id: string) {
		this.data = this.data.filter((c) => c.id !== id);
		this.save();
	}

	save() {
		saveToStorage('finances_categories', $state.snapshot(this.data));
	}
}
