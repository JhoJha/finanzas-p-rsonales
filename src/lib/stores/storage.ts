import { browser } from '$app/environment';

export const FINANCE_STATE_KEY = 'finances_state_v4';

export interface FinanceStateSnapshot {
	version?: number;
	transactions: unknown[];
	categories: unknown[];
	goals: unknown[];
	accounts: unknown[];
	budgets: unknown[];
	recurringTransactions: unknown[];
	debts: unknown[];
	settings: unknown;
	exportedAt?: string;
}

export async function loadFromStorage<T>(key: string, defaultValue: T): Promise<T> {
	if (!browser) return defaultValue;
	
	try {
		const { get } = await import('idb-keyval');
		const stored = await get<T>(key);
		
		if (stored !== undefined) {
			return stored;
		}

		// Migración desde localStorage
		const lsItem = localStorage.getItem(key);
		if (lsItem) {
			const parsed = JSON.parse(lsItem);
			await saveToStorage(key, parsed);
			localStorage.removeItem(key);
			return parsed as T;
		}
	} catch (e) {
		console.error(`Error loading ${key} from storage`, e);
	}
	
	return defaultValue;
}

export async function saveToStorage<T>(key: string, value: T): Promise<void> {
	if (!browser) return;
	
	try {
		const { set } = await import('idb-keyval');
		await set(key, value);
	} catch (e) {
		console.error(`Error saving ${key} to storage`, e);
		throw e;
	}
}

/** Guarda todo el estado financiero en una sola clave de IndexedDB. */
export async function saveFinanceSnapshot(snapshot: FinanceStateSnapshot): Promise<void> {
	await saveToStorage(FINANCE_STATE_KEY, snapshot);
}

export async function loadFinanceSnapshot(): Promise<FinanceStateSnapshot | null> {
	if (!browser) return null;

	// A diferencia de las claves heredadas, este snapshot es la fuente de verdad:
	// un fallo de lectura nunca puede convertirse en una migración desde datos viejos.
	const { get } = await import('idb-keyval');
	const stored = await get<FinanceStateSnapshot>(FINANCE_STATE_KEY);
	if (stored !== undefined) return stored;

	// Solo migra la copia local del mismo snapshot cuando IndexedDB confirmó ausencia.
	const legacySnapshot = localStorage.getItem(FINANCE_STATE_KEY);
	if (!legacySnapshot) return null;
	const parsed = JSON.parse(legacySnapshot) as FinanceStateSnapshot;
	await saveFinanceSnapshot(parsed);
	localStorage.removeItem(FINANCE_STATE_KEY);
	return parsed;
}
