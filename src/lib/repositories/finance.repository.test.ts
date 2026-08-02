import { describe, expect, it, vi } from 'vitest';
import { CorruptFinanceStateError, FinanceRepository, FutureFinanceStateError, migrateFinanceState } from '$lib/repositories/finance.repository';
import { createFinanceState, createSettings } from '$lib/test/factories';

describe('FinanceRepository migrations', () => {
	it('migrates v4, v5 and v6 snapshots to v7 while preserving state', () => {
		const state = createFinanceState({ version: 4 });
		expect(migrateFinanceState(state)).toMatchObject({ version: 7, accounts: state.accounts, settings: state.settings });
		expect(migrateFinanceState({ ...state, version: 5 }).version).toBe(7);
		expect(migrateFinanceState({ ...state, version: 6 }).version).toBe(7);
	});

	it('adds canonical metadata without changing legacy category IDs or transactions', () => {
		const state = createFinanceState({
			version: 6,
			categories: [{ id: '1', name: 'Alimentos personalizados', icon: 'tag', color: 'bg-orange-500', type: 'expense' }],
			settings: createSettings({ locale: undefined, timeZone: undefined })
		});

		const migrated = migrateFinanceState(state);
		expect(migrated.categories).toEqual([{ id: '1', code: 'food', name: 'Alimentos personalizados', icon: 'tag', color: 'bg-orange-500', type: 'expense' }]);
		expect(migrated.settings).toMatchObject({ locale: 'es-PE', timeZone: 'America/Lima' });
	});

	it('rejects a future version before normalization can discard unknown fields', () => {
		const repository = new FinanceRepository();
		const future = { ...createFinanceState({ version: 8 }), futureOnlyField: { preservedByNewerApp: true } };
		expect(() => repository.deserialize(JSON.stringify(future), createSettings())).toThrow(FutureFinanceStateError);
		expect(() => migrateFinanceState(future)).toThrow(FutureFinanceStateError);
	});

	it('treats an existing invalid snapshot as corrupt instead of falling back to legacy', () => {
		const repository = new FinanceRepository();
		expect(() => repository.deserialize('{"version":6}', createSettings())).toThrow(CorruptFinanceStateError);
	});

	it('serializes every new backup with the current state version', () => {
		const repository = new FinanceRepository();
		expect(JSON.parse(repository.serialize(createFinanceState({ version: 4 })))).toMatchObject({ version: 7 });
	});

	it('propagates a consolidated-storage read failure instead of falling back to legacy', async () => {
		const load = vi.fn().mockRejectedValue(new Error('IndexedDB unavailable'));
		const save = vi.fn();
		const repository = new FinanceRepository({ load, save });

		await expect(repository.load(createFinanceState())).rejects.toThrow('IndexedDB unavailable');
		expect(save).not.toHaveBeenCalled();
	});
});
