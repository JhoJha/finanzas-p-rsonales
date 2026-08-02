import { browser } from '$app/environment';

export const FINANCE_STATE_KEY = 'finances_state_v4';
const RECEIPT_KEY_PREFIX = 'finances_receipt_v1:';

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

/** Migra comprobantes Base64 de versiones previas al almacén binario local. */
async function separateLegacyReceiptPayloads(snapshot: FinanceStateSnapshot): Promise<FinanceStateSnapshot> {
	let changed = false;
	const transactions = await Promise.all(snapshot.transactions.map(async (raw) => {
		if (!raw || typeof raw !== 'object') return raw;
		const transaction = raw as Record<string, unknown>;
		const receipt = transaction.receipt;
		if (!receipt || typeof receipt !== 'object' || typeof (receipt as Record<string, unknown>).dataUrl !== 'string') return raw;
		const legacy = receipt as Record<string, unknown>;
		const blob = await (await fetch(legacy.dataUrl as string)).blob();
		const id = typeof legacy.id === 'string' && legacy.id ? legacy.id : crypto.randomUUID();
		await saveReceipt(id, blob);
		changed = true;
		const { dataUrl: _payload, ...metadata } = legacy;
		return { ...transaction, receipt: { ...metadata, id, size: blob.size, mimeType: typeof legacy.mimeType === 'string' ? legacy.mimeType : blob.type || 'application/octet-stream' } };
	}));
	return changed ? { ...snapshot, transactions } : snapshot;
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

/** Los binarios no forman parte del snapshot ni de su historial automático. */
export async function saveReceipt(id: string, blob: Blob): Promise<void> {
	await saveToStorage(`${RECEIPT_KEY_PREFIX}${id}`, blob);
}

export async function loadReceipt(id: string): Promise<Blob | null> {
	return loadFromStorage<Blob | null>(`${RECEIPT_KEY_PREFIX}${id}`, null);
}

export async function deleteReceipt(id: string): Promise<void> {
	if (!browser) return;
	const { del } = await import('idb-keyval');
	await del(`${RECEIPT_KEY_PREFIX}${id}`);
}

/** Guarda todo el estado financiero en una sola clave de IndexedDB. */
export async function saveFinanceSnapshot(snapshot: FinanceStateSnapshot): Promise<void> {
	await saveToStorage(FINANCE_STATE_KEY, await separateLegacyReceiptPayloads(snapshot));
}

export async function loadFinanceSnapshot(): Promise<FinanceStateSnapshot | null> {
	if (!browser) return null;

	// A diferencia de las claves heredadas, este snapshot es la fuente de verdad:
	// un fallo de lectura nunca puede convertirse en una migración desde datos viejos.
	const { get } = await import('idb-keyval');
	const stored = await get<FinanceStateSnapshot>(FINANCE_STATE_KEY);
	if (stored !== undefined) {
		const normalized = await separateLegacyReceiptPayloads(stored);
		if (normalized !== stored) await saveToStorage(FINANCE_STATE_KEY, normalized);
		return normalized;
	}

	// Solo migra la copia local del mismo snapshot cuando IndexedDB confirmó ausencia.
	const legacySnapshot = localStorage.getItem(FINANCE_STATE_KEY);
	if (!legacySnapshot) return null;
	const parsed = JSON.parse(legacySnapshot) as FinanceStateSnapshot;
	await saveFinanceSnapshot(parsed);
	localStorage.removeItem(FINANCE_STATE_KEY);
	return parsed;
}
