import { describe, expect, it } from 'vitest';
import { CorruptFinanceStateError, FinanceRepository, FutureFinanceStateError, migrateFinanceState } from '$lib/repositories/finance.repository';
import { createFinanceState, createSettings } from '$lib/test/factories';

describe('FinanceRepository migrations', () => {
	it('migrates v4 and v5 snapshots to v6 while preserving state', () => {
		const state = createFinanceState({ version: 4 });
		expect(migrateFinanceState(state)).toMatchObject({ version: 6, accounts: state.accounts, settings: state.settings });
		expect(migrateFinanceState({ ...state, version: 5 }).version).toBe(6);
		expect(migrateFinanceState({ ...state, version: 6 }).version).toBe(6);
	});

	it('rejects a future version before normalization can discard unknown fields', () => {
		const repository = new FinanceRepository();
		const future = { ...createFinanceState({ version: 7 }), futureOnlyField: { preservedByNewerApp: true } };
		expect(() => repository.deserialize(JSON.stringify(future), createSettings())).toThrow(FutureFinanceStateError);
		expect(() => migrateFinanceState(future)).toThrow(FutureFinanceStateError);
	});

	it('treats an existing invalid snapshot as corrupt instead of falling back to legacy', () => {
		const repository = new FinanceRepository();
		expect(() => repository.deserialize('{"version":6}', createSettings())).toThrow(CorruptFinanceStateError);
	});

	it('serializes every new backup with the current state version', () => {
		const repository = new FinanceRepository();
		expect(JSON.parse(repository.serialize(createFinanceState({ version: 4 })))).toMatchObject({ version: 6 });
	});
});
