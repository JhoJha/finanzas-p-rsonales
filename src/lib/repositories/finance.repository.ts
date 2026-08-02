import { defaultCategories, type Account, type Budget, type Category, type Debt, type Goal, type RecurringTransaction, type Settings, type Transaction } from '$lib/schema';
import { parseAndValidateBackup } from '$lib/utils/backup';
import { loadFinanceSnapshot, saveFinanceSnapshot, type FinanceStateSnapshot } from '$lib/stores/storage';
import { categoryCodeForLegacyId } from '$lib/domain/category-codes';
import { DEFAULT_LOCALE, DEFAULT_TIME_ZONE } from '$lib/i18n';

export const CURRENT_FINANCE_STATE_VERSION = 8;

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
	source: 'legacy' | 'snapshot';
}

export interface FinanceStorageGateway {
	load(): Promise<FinanceStateSnapshot | null>;
	save(snapshot: FinanceStateSnapshot): Promise<void>;
}

/** El estado fue creado por una versión más reciente y no puede escribirse con seguridad. */
export class FutureFinanceStateError extends Error {
	constructor(version: number) {
		super(`Este dispositivo contiene datos de la versión ${version}. Actualiza la aplicación antes de abrirlos.`);
		this.name = 'FutureFinanceStateError';
	}
}

/** El snapshot existe, pero no puede validarse sin arriesgar una sobrescritura. */
export class CorruptFinanceStateError extends Error {
	constructor(cause?: unknown) {
		super('No se pudo leer el estado financiero guardado. Restaura un respaldo válido antes de continuar.');
		this.name = 'CorruptFinanceStateError';
		this.cause = cause;
	}
}

/** Las migraciones son explícitas aunque hoy no requieran transformar campos. */
export function migrateFinanceState(state: FinanceState): FinanceState {
	let migrated = { ...state, version: state.version || 4 };
	if (migrated.version > CURRENT_FINANCE_STATE_VERSION) throw new FutureFinanceStateError(migrated.version);
	if (migrated.version < 5) migrated = { ...migrated, version: 5 }; // v4 -> v5: snapshot consolidado
	if (migrated.version < 6) migrated = { ...migrated, version: 6 }; // v5 -> v6: repositorio único
	if (migrated.version < 7) {
		migrated = {
			...migrated,
			version: 7,
			categories: migrated.categories.map((category) => ({
				...category,
				code: category.code ?? categoryCodeForLegacyId(category.id)
			})),
			settings: {
				...migrated.settings,
				locale: migrated.settings.locale ?? DEFAULT_LOCALE,
				timeZone: migrated.settings.timeZone ?? DEFAULT_TIME_ZONE
			}
		};
	}
	if (migrated.version < 8) {
		const uncategorized = defaultCategories.find((category) => category.code === 'uncategorized');
		migrated = {
			...migrated,
			version: 8,
			categories: migrated.categories.some((category) => category.code === 'uncategorized' || category.id === '7') || !uncategorized
				? migrated.categories
				: [...migrated.categories, uncategorized]
		};
	}
	return migrated;
}

function rawVersion(snapshot: unknown): number {
	if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new CorruptFinanceStateError();
	const version = (snapshot as FinanceStateSnapshot).version ?? 4;
	if (!Number.isInteger(version) || version <= 0) throw new CorruptFinanceStateError();
	return version;
}

export class FinanceRepository {
	constructor(private readonly storage: FinanceStorageGateway = { load: loadFinanceSnapshot, save: saveFinanceSnapshot }) {}

	/** Valida, normaliza y migra cualquier backup mediante el mismo pipeline del snapshot. */
	deserialize(json: string, fallbackSettings: Settings): FinanceState {
		try {
			const raw = JSON.parse(json) as FinanceStateSnapshot;
			const version = rawVersion(raw);
			if (version > CURRENT_FINANCE_STATE_VERSION) throw new FutureFinanceStateError(version);
			const backup = parseAndValidateBackup(json);
			return migrateFinanceState({
				version,
				transactions: backup.transactions,
				categories: backup.categories,
				goals: backup.goals,
				accounts: backup.accounts,
				budgets: backup.budgets,
				recurringTransactions: backup.recurringTransactions,
				debts: backup.debts,
				settings: backup.settings ?? fallbackSettings
			});
		} catch (error) {
			if (error instanceof FutureFinanceStateError || error instanceof CorruptFinanceStateError) throw error;
			throw new CorruptFinanceStateError(error);
		}
	}

	async load(legacyState: FinanceState): Promise<RepositoryLoadResult> {
		const snapshot = await this.storage.load();
		if (snapshot === null) return { state: migrateFinanceState(legacyState), migrated: true, source: 'legacy' };
		const state = this.deserialize(JSON.stringify(snapshot), legacyState.settings);
		return { state, migrated: state.version !== rawVersion(snapshot), source: 'snapshot' };
	}

	serialize(state: FinanceState): string {
		return JSON.stringify({ ...state, version: CURRENT_FINANCE_STATE_VERSION, exportedAt: new Date().toISOString() }, null, 2);
	}

	async save(state: FinanceState): Promise<void> {
		await this.storage.save(JSON.parse(this.serialize(state)) as FinanceStateSnapshot);
	}
}
