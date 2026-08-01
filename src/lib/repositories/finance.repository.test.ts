import { describe, expect, it } from 'vitest';
import { migrateFinanceState } from '$lib/repositories/finance.repository';
import { createFinanceState } from '$lib/test/factories';

describe('FinanceRepository migrations', () => {
	it('migra explícitamente snapshots v4 y v5 a v6 sin perder el estado', () => {
		const state = createFinanceState({ version: 4 });
		expect(migrateFinanceState(state)).toMatchObject({ version: 6, accounts: state.accounts, settings: state.settings });
		expect(migrateFinanceState({ ...state, version: 5 }).version).toBe(6);
	});
});
