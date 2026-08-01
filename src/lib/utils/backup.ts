import { BackupSchema, defaultCategories, type FinanceBackup } from '$lib/schema';

export interface BackupPreview {
	valid: boolean;
	error?: string;
	version?: number;
	exportedAt?: string;
	counts?: {
		transactions: number;
		accounts: number;
		categories: number;
		goals: number;
		debts: number;
	};
}

export function parseAndValidateBackup(json: string): FinanceBackup {
	const backup = BackupSchema.parse(JSON.parse(json));
	const categories = [
		...backup.categories.filter((category) => !category.id.startsWith('__')),
		...defaultCategories.filter((category) => category.id.startsWith('__'))
	];
	const accountIds = new Set(backup.accounts.map((account) => account.id));
	const categoryIds = new Set(categories.map((category) => category.id));

	if (accountIds.size !== backup.accounts.length) throw new Error('Las cuentas del backup tienen identificadores duplicados.');
	if (categoryIds.size !== categories.length) throw new Error('Las categorías del backup tienen identificadores duplicados.');

	for (const transaction of backup.transactions) {
		if (!accountIds.has(transaction.accountId) || (transaction.type !== 'transfer' && !categoryIds.has(transaction.categoryId))) {
			throw new Error('El backup contiene una transacción con una cuenta o categoría inexistente.');
		}
		if (transaction.type === 'transfer' && (!transaction.toAccountId || !accountIds.has(transaction.toAccountId) || transaction.toAccountId === transaction.accountId)) {
			throw new Error('El backup contiene una transferencia inválida.');
		}
	}

	for (const budget of backup.budgets) {
		if (!categoryIds.has(budget.categoryId)) throw new Error('El backup contiene un presupuesto con categoría inexistente.');
	}
	for (const recurring of backup.recurringTransactions) {
		if (!accountIds.has(recurring.accountId) || (recurring.type === 'transfer' && (!recurring.toAccountId || !accountIds.has(recurring.toAccountId) || recurring.toAccountId === recurring.accountId)) || (recurring.type !== 'transfer' && !categoryIds.has(recurring.categoryId))) {
			throw new Error('El backup contiene una transacción recurrente inválida.');
		}
	}
	for (const debt of backup.debts) {
		if (debt.accountId && !accountIds.has(debt.accountId)) throw new Error('El backup contiene una deuda con cuenta inexistente.');
	}

	return { ...backup, categories };
}

export function previewBackup(json: string): BackupPreview {
	try {
		const backup = parseAndValidateBackup(json);
		return {
			valid: true,
			version: backup.version,
			exportedAt: backup.exportedAt,
			counts: {
				transactions: backup.transactions.length,
				accounts: backup.accounts.length,
				categories: backup.categories.filter((category) => !category.id.startsWith('__')).length,
				goals: backup.goals.length,
				debts: backup.debts.length
			}
		};
	} catch (error) {
		return { valid: false, error: error instanceof Error ? error.message : 'Archivo inválido.' };
	}
}
