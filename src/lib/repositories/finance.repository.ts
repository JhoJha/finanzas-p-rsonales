import type { Account, Budget, Category, Debt, Goal, RecurringTransaction, Settings, Transaction } from '$lib/schema';
import { parseAndValidateBackup } from '$lib/utils/backup';
import { loadFinanceSnapshot, saveFinanceSnapshot } from '$lib/stores/storage';

export const CURRENT_FINANCE_STATE_VERSION = 6;

export interface FinanceState {
	version: number;
	transactions: Transaction[];
	categories: Category[];
	goals: Goal[];
	accounts: Account[];
	budgets: Budget[];
	recurringTransactions: RecurringTransaction[];
	debts: Debt[];
	settings: Settings;
}

export interface RepositoryLoadResult {
	state: FinanceState;
	migrated: boolean;
}

/** Las migraciones son explícitas aunque hoy no requieran transformar campos. */
export function migrateFinanceState(state: FinanceState): FinanceState {
	let migrated = { ...state, version: state.version || 4 };
	if (migrated.version < 5) migrated = { ...migrated, version: 5 }; // v4 -> v5: snapshot consolidado
	if (migrated.version < 6) migrated = { ...migrated, version: 6 }; // v5 -> v6: repositorio único
	return migrated;
}

export class FinanceRepository {
	async load(legacyState: FinanceState): Promise<RepositoryLoadResult> {
		const snapshot = await loadFinanceSnapshot();
		if (!snapshot) return { state: migrateFinanceState(legacyState), migrated: true };
		const restored = parseAndValidateBackup(JSON.stringify(snapshot));
		const state = migrateFinanceState({
			version: restored.version ?? 4,
			transactions: restored.transactions,
			categories: restored.categories,
			goals: restored.goals,
			accounts: restored.accounts,
			budgets: restored.budgets,
			recurringTransactions: restored.recurringTransactions,
			debts: restored.debts,
			settings: restored.settings ?? legacyState.settings
		});
		return { state, migrated: state.version !== (restored.version ?? 4) };
	}

	async save(state: FinanceState): Promise<void> {
		await saveFinanceSnapshot({ ...state, version: CURRENT_FINANCE_STATE_VERSION, exportedAt: new Date().toISOString() });
	}
}
