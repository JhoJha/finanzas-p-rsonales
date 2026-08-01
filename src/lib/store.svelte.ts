import { type Category, type Transaction, type Goal, type Account, type Budget, type RecurringTransaction, type Debt, type Settings, type ImportRow, INTERNAL_CATEGORY_DEBT_PAYMENT, INTERNAL_CATEGORY_SAVINGS, AccountSchema, BudgetSchema, DebtSchema, GoalSchema, RecurringTransactionSchema, SettingsSchema, TransactionSchema } from './schema';
import { toastStore } from './toast.svelte';
import { browser } from '$app/environment';

import { AccountsStore } from './stores/accounts.svelte';
import { TransactionsStore } from './stores/transactions.svelte';
import { CategoriesStore } from './stores/categories.svelte';
import { GoalsStore } from './stores/goals.svelte';
import { BudgetsStore } from './stores/budgets.svelte';
import { DebtsStore } from './stores/debts.svelte';
import { RecurringStore } from './stores/recurring.svelte';
import { SettingsStore } from './stores/settings.svelte';
import { formatCurrency } from './utils/currency';
import { dateFromDateOnly, formatDateOnly } from './utils/date';
import { getExchangeRateToBase, getMissingExchangeRateCurrencies, projectDebtRepayment, transactionAmountInBase } from './utils/finance';
import { previewBackup, type BackupPreview } from './utils/backup';
import { loadFromStorage, saveToStorage } from './stores/storage';
import { calculateCashForecast, detectSubscriptions } from './utils/forecast';
import { buildMonthlyReview, buildNetWorthHistory, invalidateNetWorthSnapshotsFrom } from './utils/insights';
import { fetchExchangeRatesToBase, shouldRefreshExchangeRates } from './utils/exchange-rates';
import { CURRENT_FINANCE_STATE_VERSION, CorruptFinanceStateError, FinanceRepository, FutureFinanceStateError, type FinanceState } from './repositories/finance.repository';
import { TransactionService } from './services/transaction.service';
import { DebtService } from './services/debt.service';
import { GoalService } from './services/goal.service';
import { RecurringService } from './services/recurring.service';
import { ReportsService, type ReportPeriod } from './services/reports.service';

export type Period = ReportPeriod;
export type ExchangeRateRefreshResult =
	| { status: 'updated'; currencies: string[] }
	| { status: 'not-needed' | 'up-to-date' | 'unavailable' }
	| { status: 'failed'; error: string };
export type PersistenceStatus = 'saved' | 'saving' | 'error';

export class FinanceStoreFacade {
	private accountsStore = new AccountsStore();
	private transactionsStore = new TransactionsStore();
	private categoriesStore = new CategoriesStore();
	private goalsStore = new GoalsStore();
	private budgetsStore = new BudgetsStore();
	private debtsStore = new DebtsStore();
	private recurringStore = new RecurringStore();
	private settingsStore = new SettingsStore();
	private repository = new FinanceRepository();

	isReady = $state(false);
	persistenceStatus = $state<PersistenceStatus>('saved');
	lastSavedAt = $state<string | undefined>(undefined);
	persistenceError = $state<string | undefined>(undefined);
	recoveryRequired = $state(false);
	private lastDeletedTransaction: Transaction | null = null;
	private backupTimer: ReturnType<typeof setTimeout> | undefined;
	private persistenceQueue: Promise<void> = Promise.resolve();
	private exchangeRateRefreshInFlight: Promise<ExchangeRateRefreshResult> | null = null;

	constructor() {
		if (browser) {
			this.initAll();
		}
	}

	async initAll() {
		await Promise.all([
			this.accountsStore.init(),
			this.transactionsStore.init(),
			this.categoriesStore.init(),
			this.goalsStore.init(),
			this.budgetsStore.init(),
			this.debtsStore.init(),
			this.recurringStore.init(),
			this.settingsStore.init()
		]);
		// Las claves individuales solo se leen para migrar instalaciones anteriores.
		try {
			const result = await this.repository.load(this.persistenceState(4));
			this.replaceState(result.state);
			if (result.migrated) this.persistState();
		} catch (error) {
			this.recoveryRequired = true;
			this.persistenceStatus = 'error';
			this.persistenceError = error instanceof CorruptFinanceStateError || error instanceof FutureFinanceStateError
				? error.message
				: 'No se pudo verificar el estado financiero guardado. Restaura un respaldo antes de continuar.';
			this.isReady = true;
			return;
		}
		
		this.migrateInitialBalances();
		this.recalculateBalances();
		if (this.missingExchangeRateCurrencies.length === 0) this.capturePreviousMonthNetWorth();
		// Recurring txs are no longer processed automatically, user must approve them
		
		this.isReady = true;
		// No bloquea la carga: se conservan las tasas locales si el proveedor no está disponible.
		void this.refreshExchangeRates();
	}

	recalculateBalances() {
		this.accountsStore.data = this.accounts.map((account) => ({ ...account, balance: account.initialBalance ?? 0 }));
		this.transactionsStore.data.forEach((transaction) => this.applyTransactionEffect(transaction, 1));
	}

	/**
	 * Las versiones anteriores guardaban solamente el saldo calculado. Para no
	 * alterar lo que el usuario ve al actualizar, inferimos el saldo de apertura
	 * restando el efecto de las transacciones ya registradas.
	 */
	private migrateInitialBalances() {
		let migrated = false;

		this.accountsStore.data.forEach(account => {
			if (account.initialBalance !== undefined) return;

			const transactionNet = this.transactionsStore.data.reduce((net, transaction) => {
				if (transaction.type === 'income' && transaction.accountId === account.id) return net + transaction.amount;
				if (transaction.type === 'expense' && transaction.accountId === account.id) return net - transaction.amount;
				if (transaction.type === 'transfer') {
					if (transaction.accountId === account.id) return net - transaction.amount;
					if (transaction.toAccountId === account.id) return net + (transaction.toAmount ?? transaction.amount);
				}
				return net;
			}, 0);

			account.initialBalance = account.balance - transactionNet;
			migrated = true;
		});

		if (migrated) this.persistState();
	}

	private applyTransactionEffect(t: Transaction, multiplier: number) {
		this.accountsStore.data = TransactionService.applyAccountEffect(this.accounts, t, multiplier);
	}

	private snapshotExchangeRate(transaction: Transaction): Transaction {
		const account = this.accounts.find((item) => item.id === transaction.accountId);
		const destination = transaction.toAccountId ? this.accounts.find((item) => item.id === transaction.toAccountId) : undefined;
		const sourceRate = transaction.exchangeRate ?? getExchangeRateToBase(account?.currency, this.settings);
		const destinationRate = transaction.toExchangeRate ?? getExchangeRateToBase(destination?.currency, this.settings);
		return {
			...transaction,
			exchangeRate: sourceRate,
			toExchangeRate: destination ? destinationRate : undefined,
			toAmount: transaction.type === 'transfer' && destination
				? (transaction.toAmount ?? Math.round((transaction.amount * sourceRate / destinationRate) * 100) / 100)
				: undefined,
			baseCurrency: transaction.baseCurrency ?? this.settings.baseCurrency
		};
	}

	/** Valida que un movimiento ligado a deuda pueda aplicar su efecto una sola vez. */
	private canApplyLinkedTransaction(transaction: Transaction): boolean {
		if (!DebtService.canApplyPayment(this.debts, transaction)) {
			toastStore.add('El abono no es válido para el saldo pendiente de la deuda.', 'error');
			return false;
		}
		return true;
	}

	private persistenceState(version = CURRENT_FINANCE_STATE_VERSION): FinanceState {
		return {
			version,
			transactions: $state.snapshot(this.transactionsStore.data), categories: $state.snapshot(this.categoriesStore.data),
			goals: $state.snapshot(this.goalsStore.data), accounts: $state.snapshot(this.accountsStore.data),
			budgets: $state.snapshot(this.budgetsStore.data), recurringTransactions: $state.snapshot(this.recurringStore.data),
			debts: $state.snapshot(this.debtsStore.data), settings: $state.snapshot(this.settingsStore.data)
		};
	}

	private replaceState(state: FinanceState) {
		this.accountsStore.data = state.accounts;
		this.transactionsStore.data = state.transactions;
		this.categoriesStore.data = state.categories;
		this.goalsStore.data = state.goals;
		this.budgetsStore.data = state.budgets;
		this.debtsStore.data = state.debts;
		this.recurringStore.data = state.recurringTransactions;
		this.settingsStore.data = state.settings;
	}

	/** Hidrata un estado validado, usado por restauración y pruebas de dominio. */
	hydrateState(state: FinanceState) {
		this.replaceState(state);
	}

	private persistState() {
		if (!browser || this.recoveryRequired) return;
		const snapshot = this.persistenceState();
		this.persistenceStatus = 'saving';
		this.persistenceError = undefined;
		this.persistenceQueue = this.persistenceQueue
			.catch(() => undefined)
			.then(() => this.repository.save(snapshot))
			.then(() => {
				this.persistenceStatus = 'saved';
				this.lastSavedAt = new Date().toISOString();
			})
			.catch((error) => {
				console.error('Could not persist finance state', error);
				this.persistenceStatus = 'error';
				this.persistenceError = 'No se pudieron guardar los cambios en este dispositivo.';
			});
	}

	private scheduleAutomaticBackup() {
		if (!browser) return;
		this.persistState();
		if (this.backupTimer) clearTimeout(this.backupTimer);
		this.backupTimer = setTimeout(() => {
			void (async () => {
				try {
					const snapshot = JSON.parse(this.exportToJSON());
					const history = await loadFromStorage<any[]>('finances_backup_history', []);
					await saveToStorage('finances_backup_history', [snapshot, ...history].slice(0, 5));
				} catch (error) {
					console.warn('Could not save automatic backup history', error);
				}
			})();
		}, 500);
	}

	getTransactionAmountInBase(transaction: Transaction): number {
		const account = this.accounts.find((item) => item.id === transaction.accountId);
		return transactionAmountInBase(transaction, account?.currency, this.settings);
	}

	// === Derived State Accessors ===
	get categories() { return this.categoriesStore.data; }
	get transactions() { return this.transactionsStore.data; }
	get goals() { return this.goalsStore.data; }
	get budgets() { return this.budgetsStore.data; }
	get recurringTransactions() { return this.recurringStore.data; }
	get debts() { return this.debtsStore.data; }
	get accounts() { return this.accountsStore.data; }
	get settings() { return this.settingsStore.data; }
	/** Monedas de cuentas que impedirían convertir cifras con seguridad. */
	get missingExchangeRateCurrencies(): string[] {
		return getMissingExchangeRateCurrencies(this.accounts, this.settings);
	}

	private invalidateNetWorthSnapshots(affectedAt: string | Date) {
		const snapshots = invalidateNetWorthSnapshotsFrom(this.settings.netWorthSnapshots, affectedAt);
		if (snapshots.length !== this.settings.netWorthSnapshots.length) {
			this.settingsStore.updateSettings({ netWorthSnapshots: snapshots });
		}
	}

	/** Actualiza las tasas de las monedas realmente usadas por las cuentas. */
	refreshExchangeRates(force = false): Promise<ExchangeRateRefreshResult> {
		if (!browser) return Promise.resolve({ status: 'unavailable' });
		if (this.exchangeRateRefreshInFlight) return this.exchangeRateRefreshInFlight;

		const currencies = [...new Set(this.accounts
			.map((account) => account.currency?.trim().toUpperCase())
			.filter((currency): currency is string => Boolean(currency) && currency !== this.settings.baseCurrency.toUpperCase()))];
		if (!currencies.length) return Promise.resolve({ status: 'not-needed' });
		if (!force && !shouldRefreshExchangeRates(this.settings.exchangeRatesUpdatedAt)) return Promise.resolve({ status: 'up-to-date' });

		this.exchangeRateRefreshInFlight = fetchExchangeRatesToBase(this.settings.baseCurrency, currencies)
			.then((freshRates) => {
				const updated = this.updateSettings({
					exchangeRates: { ...this.settings.exchangeRates, ...freshRates },
					exchangeRatesUpdatedAt: new Date().toISOString()
				});
				if (!updated) return { status: 'failed', error: 'No se pudieron guardar las tasas actualizadas.' } as ExchangeRateRefreshResult;
				return { status: 'updated', currencies: Object.keys(freshRates) } as ExchangeRateRefreshResult;
			})
			.catch((error) => {
				console.warn('Could not refresh exchange rates', error);
				return { status: 'failed', error: error instanceof Error ? error.message : 'No se pudo actualizar el tipo de cambio.' } as ExchangeRateRefreshResult;
			})
			.finally(() => { this.exchangeRateRefreshInFlight = null; });
		return this.exchangeRateRefreshInFlight;
	}

	// === Transactions ===
	addTransaction(transaction: Transaction): boolean {
		const sourceAccount = this.accounts.find((account) => account.id === transaction.accountId);
		const destinationAccount = transaction.toAccountId ? this.accounts.find((account) => account.id === transaction.toAccountId) : undefined;
		const missingRate = [sourceAccount, destinationAccount].find((account) => account?.currency && account.currency.toUpperCase() !== this.settings.baseCurrency && !this.settings.exchangeRates[account.currency.toUpperCase()]);
		if (missingRate) { toastStore.add(`Falta la tasa de cambio para ${missingRate.currency}.`, 'error'); return false; }
		const parsed = TransactionSchema.safeParse(this.snapshotExchangeRate(transaction));
		if (!parsed.success || !this.accounts.some((account) => account.id === parsed.data.accountId) || (parsed.data.type !== 'transfer' && !this.categories.some((category) => category.id === parsed.data.categoryId && category.type === parsed.data.type)) || (parsed.data.type === 'transfer' && (!parsed.data.toAccountId || parsed.data.toAccountId === parsed.data.accountId || !this.accounts.some((account) => account.id === parsed.data.toAccountId))) || !this.canApplyLinkedTransaction(parsed.data)) {
			toastStore.add('La transacción no es válida.', 'error');
			return false;
		}
		this.transactionsStore.addTransaction(parsed.data);
		this.applyTransactionEffect(parsed.data, 1);
		this.applyLinkedTransactionEffect(parsed.data, 1);
		this.invalidateNetWorthSnapshots(parsed.data.date);
		this.scheduleAutomaticBackup();
		return true;
	}

	/** Importa movimientos validados como una única operación de estado. */
	importTransactions(rows: ImportRow[], accountId: string): { imported: number; skipped: number } {
		if (!this.accounts.some((account) => account.id === accountId)) throw new Error('Selecciona una cuenta válida.');
		const existing = new Set(this.transactions.map((transaction) => {
			const merchant = (transaction.note || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
			return `${transaction.date.slice(0, 10)}|${transaction.amount.toFixed(2)}|${merchant}`;
		}));
		const candidates: Transaction[] = [];
		for (const row of rows.filter((item) => item.selected && !item.duplicate)) {
			const type = row.amount < 0 ? 'expense' : 'income';
			const categoryId = row.categoryId && this.categories.some((category) => category.id === row.categoryId && category.type === type)
				? row.categoryId
				: this.categories.find((category) => category.type === type && !category.id.startsWith('__'))?.id;
			if (!categoryId) continue;
			const date = new Date(row.date);
			if (Number.isNaN(date.getTime())) continue;
			const transaction = this.snapshotExchangeRate({ id: crypto.randomUUID(), date: date.toISOString(), amount: Math.abs(row.amount), categoryId, accountId, note: row.description, type });
			const key = `${transaction.date.slice(0, 10)}|${transaction.amount.toFixed(2)}|${row.merchant}`;
			if (existing.has(key) || candidates.some((candidate) => `${candidate.date.slice(0, 10)}|${candidate.amount.toFixed(2)}|${(candidate.note || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()}` === key)) continue;
			candidates.push(transaction);
		}
		if (candidates.length) {
			this.transactionsStore.data = [...this.transactionsStore.data, ...candidates];
			this.recalculateBalances();
			this.invalidateNetWorthSnapshots(candidates.reduce((earliest, transaction) => transaction.date < earliest ? transaction.date : earliest, candidates[0].date));
			this.scheduleAutomaticBackup();
		}
		return { imported: candidates.length, skipped: rows.filter((item) => item.selected).length - candidates.length };
	}
	deleteTransaction(id: string): boolean {
		const t = this.transactions.find(tx => tx.id === id);
		if (!t) return false;
		this.applyTransactionEffect(t, -1);
		this.applyLinkedTransactionEffect(t, -1);
		this.transactionsStore.deleteTransaction(id);
		this.lastDeletedTransaction = t;
		this.invalidateNetWorthSnapshots(t.date);
		this.scheduleAutomaticBackup();
		return true;
	}

	restoreLastDeletedTransaction(): boolean {
		if (!this.lastDeletedTransaction || this.transactions.some((transaction) => transaction.id === this.lastDeletedTransaction?.id)) return false;
		const transaction = this.lastDeletedTransaction;
		if (!this.canApplyLinkedTransaction(transaction)) return false;
		this.transactionsStore.addTransaction(transaction);
		this.applyTransactionEffect(transaction, 1);
		this.applyLinkedTransactionEffect(transaction, 1);
		this.lastDeletedTransaction = null;
		this.invalidateNetWorthSnapshots(transaction.date);
		this.scheduleAutomaticBackup();
		return true;
	}

	private applyLinkedTransactionEffect(transaction: Transaction, multiplier: number) {
		this.debtsStore.data = DebtService.applyPayment(this.debts, transaction, multiplier);
		this.goalsStore.data = GoalService.applyContribution(this.goals, transaction, multiplier);
	}
	updateTransaction(id: string, data: Partial<Transaction>): boolean {
		const t = this.transactions.find(tx => tx.id === id);
		if (!t) return false;

		if (t.debtId || t.goalId) {
			toastStore.add('Los movimientos vinculados a deudas o metas solo se pueden revertir eliminándolos.', 'info');
			return false;
		}
		const updated = this.snapshotExchangeRate({
			...t,
			...data,
			exchangeRate: data.accountId && data.accountId !== t.accountId ? undefined : t.exchangeRate,
			baseCurrency: data.accountId && data.accountId !== t.accountId ? undefined : t.baseCurrency
		});
		const parsed = TransactionSchema.safeParse(updated);
		if (!parsed.success || !this.accounts.some(account => account.id === parsed.data.accountId) || (parsed.data.type !== 'transfer' && !this.categories.some(category => category.id === parsed.data.categoryId)) || (parsed.data.type === 'transfer' && (!parsed.data.toAccountId || parsed.data.toAccountId === parsed.data.accountId || !this.accounts.some(account => account.id === parsed.data.toAccountId)))) {
			toastStore.add('Los cambios de la transacción no son válidos.', 'error');
			return false;
		}

		this.applyTransactionEffect(t, -1);
		this.applyTransactionEffect(parsed.data, 1);
		this.transactionsStore.updateTransaction(id, parsed.data);
		this.invalidateNetWorthSnapshots(t.date < parsed.data.date ? t.date : parsed.data.date);
		this.scheduleAutomaticBackup();
		return true;
	}

	// === Accounts ===
	addAccount(account: Account) {
		const parsed = AccountSchema.safeParse({ ...account, currency: account.currency?.trim().toUpperCase(), createdAt: account.createdAt ?? new Date().toISOString() });
		if (!parsed.success) { toastStore.add('La cuenta no es válida.', 'error'); return false; }
		if (parsed.data.currency && parsed.data.currency !== this.settings.baseCurrency && !this.settings.exchangeRates[parsed.data.currency]) {
			toastStore.add(`Configura una tasa para ${parsed.data.currency} antes de crear la cuenta.`, 'error');
			return false;
		}
		this.accountsStore.addAccount({
			...parsed.data,
			initialBalance: parsed.data.initialBalance ?? parsed.data.balance
		});
		this.invalidateNetWorthSnapshots(parsed.data.createdAt ?? new Date().toISOString());
		this.scheduleAutomaticBackup();
		return true;
	}
	deleteAccount(id: string) {
		const hasTx = this.transactions.some(t => t.accountId === id || t.toAccountId === id);
		if (hasTx) {
			toastStore.add('No se puede eliminar la cuenta porque tiene transacciones asociadas.', 'error');
			return false;
		}
		const hasRecurring = this.recurringTransactions.some(rt => rt.accountId === id || rt.toAccountId === id);
		if (hasRecurring) {
			toastStore.add('No se puede eliminar la cuenta porque tiene transacciones recurrentes asociadas.', 'error');
			return false;
		}
		const hasDebts = this.debts.some(d => d.accountId === id);
		if (hasDebts) {
			toastStore.add('No se puede eliminar la cuenta porque está vinculada a deudas.', 'error');
			return false;
		}
		this.accountsStore.removeAccount(id);
		this.scheduleAutomaticBackup();
		return true;
	}

	// === Categories ===
	addCategory(category: Category) {
		if (category.id.startsWith('__')) {
			toastStore.add('Los identificadores internos están reservados para el sistema.', 'error');
			return false;
		}
		if (this.categories.some(existing => existing.id === category.id)) {
			toastStore.add('Ya existe una categoría con ese identificador.', 'error');
			return false;
		}
		this.categoriesStore.addCategory(category);
		this.scheduleAutomaticBackup();
		return true;
	}

	deleteCategory(id: string) {
		if (id.startsWith('__')) {
			toastStore.add('Las categorías internas no se pueden eliminar.', 'error');
			return false;
		}
		const hasTx = this.transactions.some(t => t.categoryId === id);
		if (hasTx) {
			toastStore.add('No se puede eliminar la categoría porque tiene transacciones asociadas.', 'error');
			return false;
		}
		const hasBudget = this.budgets.some(b => b.categoryId === id);
		if (hasBudget) {
			toastStore.add('No se puede eliminar la categoría porque tiene presupuestos asociados.', 'error');
			return false;
		}
		const hasRecurring = this.recurringTransactions.some(rt => rt.type !== 'transfer' && rt.categoryId === id);
		if (hasRecurring) {
			toastStore.add('No se puede eliminar la categoría porque tiene transacciones recurrentes asociadas.', 'error');
			return false;
		}
		this.categoriesStore.removeCategory(id);
		this.settingsStore.updateSettings({ importRules: this.settings.importRules.filter((rule) => rule.categoryId !== id) });
		this.scheduleAutomaticBackup();
		return true;
		return true;
	}

	// === Goals ===
	addGoal(goal: Goal) {
		const parsed = GoalSchema.safeParse({ ...goal, createdAt: goal.createdAt ?? new Date().toISOString() });
		if (!parsed.success) { toastStore.add('La meta no es válida.', 'error'); return false; }
		this.goalsStore.addGoal(parsed.data); this.scheduleAutomaticBackup(); return true;
	}
	deleteGoal(id: string): boolean {
		if (this.transactions.some((transaction) => transaction.goalId === id)) {
			toastStore.add('No se puede eliminar una meta con aportes registrados.', 'error');
			return false;
		}
		this.goalsStore.deleteGoal(id);
		this.scheduleAutomaticBackup();
		return true;
	}
	updateGoalProgress(id: string, amount: number) { this.goalsStore.updateGoalProgress(id, amount); this.scheduleAutomaticBackup(); }

	contributeToGoal(goalId: string, amount: number, accountId: string): boolean {
		const goal = this.goals.find((item) => item.id === goalId);
		if (!goal || !Number.isFinite(amount) || amount <= 0 || !this.accounts.some((account) => account.id === accountId)) return false;
		const account = this.accounts.find((item) => item.id === accountId);
		const accountAmount = amount / getExchangeRateToBase(account?.currency, this.settings);
		const saved = this.addTransaction({
			id: crypto.randomUUID(),
			date: new Date().toISOString(),
			amount: accountAmount,
			categoryId: INTERNAL_CATEGORY_SAVINGS,
			accountId,
			type: 'expense',
			goalId,
			note: `Ahorro: ${goal.name}`,
			linkedAmount: amount
		});
		if (!saved) return false;
		return true;
	}

	// === Budgets ===
	addBudget(budget: Budget) {
		const parsed = BudgetSchema.safeParse(budget);
		if (!parsed.success || !this.categories.some((category) => category.id === budget.categoryId && category.type === 'expense')) { toastStore.add('El presupuesto no es válido.', 'error'); return false; }
		this.budgetsStore.addBudget(parsed.data); this.scheduleAutomaticBackup(); return true;
	}
	deleteBudget(id: string) { this.budgetsStore.deleteBudget(id); this.scheduleAutomaticBackup(); }

	getBudgetProgress(identifier: string) {
		return ReportsService.budgetProgress(this.persistenceState(), identifier, (transaction) => this.getTransactionAmountInBase(transaction));
	}

	getBudgetAlerts() {
		return ReportsService.budgetAlerts(this.persistenceState(), (transaction) => this.getTransactionAmountInBase(transaction));
	}

	// === Recurring ===
	addRecurringTransaction(rt: RecurringTransaction) {
		const parsed = RecurringTransactionSchema.safeParse(rt);
		const validAccounts = this.accounts.some((account) => account.id === rt.accountId) && (!rt.toAccountId || this.accounts.some((account) => account.id === rt.toAccountId));
		const validCategory = rt.type === 'transfer' || this.categories.some((category) => category.id === rt.categoryId && category.type === rt.type);
		const linkedDebt = rt.debtId ? this.debts.find((debt) => debt.id === rt.debtId) : undefined;
		const validDebtLink = !rt.debtId || (rt.type === 'expense' && linkedDebt?.type === 'i_owe' && linkedDebt.status === 'pending');
		if (!parsed.success || !validAccounts || !validCategory || !validDebtLink || (rt.type === 'transfer' && (!rt.toAccountId || rt.toAccountId === rt.accountId))) { toastStore.add('El movimiento recurrente no es válido.', 'error'); return false; }
		this.recurringStore.addRecurringTransaction(parsed.data); this.scheduleAutomaticBackup(); return true;
	}
	deleteRecurringTransaction(id: string) { this.recurringStore.deleteRecurringTransaction(id); this.scheduleAutomaticBackup(); }
	
	getPendingRecurringTransactions() {
		const now = new Date();
		const pending: { rtId: string; tx: Transaction }[] = [];
		const maxPending = 90;
		this.recurringTransactions.forEach(rt => {
			let nextDate = dateFromDateOnly(rt.nextDate);
			while (nextDate <= now && pending.length < maxPending) {
				const sourceCurrency = this.accounts.find((account) => account.id === rt.accountId)?.currency?.toUpperCase();
				const sourceRate = !rt.debtId ? undefined : sourceCurrency && sourceCurrency !== this.settings.baseCurrency
					? this.settings.exchangeRates[sourceCurrency]
					: 1;
				pending.push({
					rtId: rt.id,
					tx: {
						id: crypto.randomUUID(),
						date: nextDate.toISOString(),
						amount: rt.amount,
						categoryId: rt.categoryId,
						accountId: rt.accountId,
						toAccountId: rt.toAccountId,
						toAmount: rt.toAmount,
						debtId: rt.debtId,
						linkedAmount: sourceRate ? Math.round(rt.amount * sourceRate * 100) / 100 : undefined,
						note: rt.note,
						type: rt.type
					}
				});
				
				nextDate = RecurringService.nextDateAfter(nextDate, rt.frequency);
			}
		});
		return pending;
	}

	approvePendingRecurring(rtId: string, tx: Transaction, accept: boolean) {
		const rt = this.recurringTransactions.find(r => r.id === rtId);
		if (!rt) return;
		
		if (accept) {
			if (!this.addTransaction(tx)) return;
		}
		
		const nextDate = RecurringService.advanceDate(rt.nextDate, tx.date, rt.frequency);
		if (nextDate !== rt.nextDate) {
			this.recurringStore.updateRecurringTransactions(
				this.recurringTransactions.map(r => r.id === rtId ? { ...r, nextDate } : r)
			);
		}
		this.scheduleAutomaticBackup();
	}

	// === Debts ===
	addDebt(debt: Debt) {
		const parsed = DebtSchema.safeParse({ ...debt, createdAt: debt.createdAt ?? new Date().toISOString() });
		if (!parsed.success || (parsed.data.accountId && !this.accounts.some((account) => account.id === parsed.data.accountId))) { toastStore.add('La deuda no es válida.', 'error'); return false; }
		this.debtsStore.addDebt(parsed.data); this.scheduleAutomaticBackup(); return true;
	}
	deleteDebt(id: string): boolean {
		if (this.transactions.some((transaction) => transaction.debtId === id) || this.recurringTransactions.some((recurring) => recurring.debtId === id)) {
			toastStore.add('No se puede eliminar una deuda con abonos o pagos recurrentes vinculados.', 'error');
			return false;
		}
		this.debtsStore.deleteDebt(id);
		this.scheduleAutomaticBackup();
		return true;
	}
	
	payDebt(debtId: string, amount: number, accountId: string): boolean {
		const debt = this.debts.find(d => d.id === debtId);
		if (!debt || debt.status !== 'pending') {
			toastStore.add('La deuda ya no está disponible para recibir abonos.', 'error');
			return false;
		}

		if (!Number.isFinite(amount) || amount <= 0) {
			toastStore.add('El monto del abono debe ser mayor que cero.', 'error');
			return false;
		}

		if (!this.accounts.some(account => account.id === accountId)) {
			toastStore.add('Selecciona una cuenta válida para el abono.', 'error');
			return false;
		}

		const remaining = debt.totalAmount - debt.paidAmount;
		if (remaining <= 0) {
			toastStore.add('Esta deuda ya está pagada.', 'error');
			return false;
		}
		if (amount > remaining) {
			toastStore.add(`El abono supera el saldo pendiente de ${this.formatCurrency(remaining)}.`, 'error');
			return false;
		}

		const account = this.accounts.find((item) => item.id === accountId);
		const accountAmount = amount / getExchangeRateToBase(account?.currency, this.settings);
		const created = this.addTransaction({
			id: crypto.randomUUID(),
			date: new Date().toISOString(),
			amount: accountAmount,
			categoryId: INTERNAL_CATEGORY_DEBT_PAYMENT,
			accountId,
			note: `Abono a deuda: ${debt.contactName}`,
			type: debt.type === 'i_owe' ? 'expense' : 'income',
			debtId,
			linkedAmount: amount
		});
		if (!created) return false;
		this.scheduleAutomaticBackup();
		return true;
	}

	getDebtProjection(debtId: string) {
		const debt = this.debts.find((item) => item.id === debtId);
		if (!debt) return null;
		const projection = projectDebtRepayment(
			Math.max(0, debt.totalAmount - debt.paidAmount),
			debt.interestRateAnnual ?? 0,
			debt.installmentAmount
		);
		const payoffDate = projection.monthsRemaining === null ? null : (() => {
			const date = new Date();
			date.setMonth(date.getMonth() + projection.monthsRemaining);
			return date;
		})();
		return { ...projection, payoffDate };
	}
	
	getOverdueDebts() {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return this.debts.filter(d =>
			d.status === 'pending' &&
			d.dueDate &&
			dateFromDateOnly(d.dueDate) < today
		);
	}

	getGoalSuggestion(goalId: string) {
		const goal = this.goals.find((item) => item.id === goalId);
		if (!goal || !goal.deadline || goal.currentAmount >= goal.targetAmount) return null;
		const deadline = dateFromDateOnly(goal.deadline);
		const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 86400000));
		const remaining = goal.targetAmount - goal.currentAmount;
		const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));
		const requiredMonthly = remaining / monthsLeft;
		const currentCapacity = Math.max(0, this.getMonthlyHealthMetrics().monthNet);
		return {
			remaining,
			daysLeft,
			requiredMonthly,
			requiredWeekly: remaining / Math.max(1, Math.ceil(daysLeft / 7)),
			currentCapacity,
			isAffordable: currentCapacity >= requiredMonthly
		};
	}

	getDetectedSubscriptions(now = new Date()) {
		return detectSubscriptions(this.transactions, this.accounts, this.settings, now);
	}

	getCashForecast(now = new Date()) {
		return calculateCashForecast(this.accounts, this.transactions, this.recurringTransactions, this.debts, this.budgets, this.categories, this.settings, now);
	}

	getMonthlyReview(now = new Date()) {
		return buildMonthlyReview(this.transactions, this.accounts, this.categories, this.goals, this.settings, this.getDetectedSubscriptions(now).length, now);
	}

	getNetWorthHistory(months = 6, now = new Date()) {
		return buildNetWorthHistory(this.accounts, this.transactions, this.goals, this.debts, this.settings, months, now);
	}

	/** Fija el cierre del mes anterior con las tasas disponibles en ese momento. */
	private capturePreviousMonthNetWorth(now = new Date()) {
		const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
		const monthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}-01`;
		if (this.settings.netWorthSnapshots.some((snapshot) => snapshot.month === monthKey)) return;
		const point = buildNetWorthHistory(this.accounts, this.transactions, this.goals, this.debts, this.settings, 1, previousMonth)[0];
		if (!point) return;
		this.settingsStore.updateSettings({
			netWorthSnapshots: [...this.settings.netWorthSnapshots, {
				month: monthKey,
				accounts: point.accounts,
				savings: point.savings,
				receivables: point.receivables,
				debts: point.debts,
				netWorth: point.netWorth,
				capturedAt: now.toISOString()
			}].slice(-60)
		});
		this.scheduleAutomaticBackup();
	}

	// === Derived Summaries & Health ===
	get summary() {
		return ReportsService.summary(this.persistenceState(), (transaction) => this.getTransactionAmountInBase(transaction));
	}

	getTransactionsByPeriod(period: Period): Transaction[] {
		return ReportsService.transactionsByPeriod(this.transactions, period);
	}

	getExpensesByCategory(period: Period = 'all') {
		return ReportsService.expensesByCategory(this.persistenceState(), (transaction) => this.getTransactionAmountInBase(transaction), period);
	}

	getWeeklyEvolution() {
		const now = new Date();
		const days: { label: string; expenses: number; income: number }[] = [];

		for (let i = 6; i >= 0; i--) {
			const d = new Date(now);
			d.setDate(d.getDate() - i);
			
			const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
			const endOfDay = startOfDay + 86400000 - 1;

			const dayTx = this.transactions.filter((t) => t.timestamp! >= startOfDay && t.timestamp! <= endOfDay);
			const expenses = dayTx.filter((t) => t.type === 'expense').reduce((a, t) => {
				return a + this.getTransactionAmountInBase(t);
			}, 0);
			const income = dayTx.filter((t) => t.type === 'income').reduce((a, t) => {
				return a + this.getTransactionAmountInBase(t);
			}, 0);

			const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
			days.push({ label: names[d.getDay()], expenses, income });
		}

		return days;
	}

	getMonthlyComparison() {
		const months: { label: string; expenses: number; income: number }[] = [];

		for (let i = 5; i >= 0; i--) {
			const d = new Date();
			d.setMonth(d.getMonth() - i);
			const month = d.getMonth();
			const year = d.getFullYear();

			const startOfMonth = new Date(year, month, 1).getTime();
			const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

			const monthTx = this.transactions.filter((t) => t.timestamp! >= startOfMonth && t.timestamp! <= endOfMonth);

			const expenses = monthTx.filter((t) => t.type === 'expense').reduce((a, t) => {
				return a + this.getTransactionAmountInBase(t);
			}, 0);
			const income = monthTx.filter((t) => t.type === 'income').reduce((a, t) => {
				return a + this.getTransactionAmountInBase(t);
			}, 0);

			const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
			months.push({ label: names[month], expenses, income });
		}

		return months;
	}

	getTopCategory(period: Period = 'all') {
		const byCat = this.getExpensesByCategory(period);
		if (byCat.length === 0) return null;
		return byCat[0];
	}

	getWeekComparison() {
		const now = new Date();
		const weekStart = new Date(now);
		weekStart.setDate(weekStart.getDate() - 7);
		const weekStartTs = weekStart.getTime();
		
		const prevStart = new Date(now);
		prevStart.setDate(prevStart.getDate() - 14);
		const prevStartTs = prevStart.getTime();

		const current = this.transactions
			.filter((t) => t.type === 'expense' && t.timestamp! >= weekStartTs)
			.reduce((a, t) => {
				return a + this.getTransactionAmountInBase(t);
			}, 0);

		const previous = this.transactions
			.filter((t) => t.type === 'expense' && t.timestamp! >= prevStartTs && t.timestamp! < weekStartTs)
			.reduce((a, t) => {
				return a + this.getTransactionAmountInBase(t);
			}, 0);

		const diff = current - previous;
		const diffPercent = previous > 0 ? Math.round((diff / previous) * 100) : (current > 0 ? 100 : 0);

		return { current, previous, diff, diffPercent };
	}

	getMonthlyHealthMetrics() {
		const now = new Date();
		const month = now.getMonth();
		const year = now.getFullYear();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const dayOfMonth = now.getDate();
		const daysLeft = daysInMonth - dayOfMonth;

		const startOfMonth = new Date(year, month, 1).getTime();
		const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

		const monthTx = this.transactions.filter(t => t.timestamp! >= startOfMonth && t.timestamp! <= endOfMonth);

		const monthIncome = monthTx.filter(t => t.type === 'income').reduce((a, t) => {
			return a + this.getTransactionAmountInBase(t);
		}, 0);
		const monthExpenses = monthTx.filter(t => t.type === 'expense').reduce((a, t) => {
			return a + this.getTransactionAmountInBase(t);
		}, 0);
		const monthNet = monthIncome - monthExpenses;

		const savingsRate = monthIncome > 0 ? Math.round((monthNet / monthIncome) * 100) : 0;
		const dailyBurnRate = dayOfMonth > 0 ? monthExpenses / dayOfMonth : 0;
		const projectedExpenses = dailyBurnRate * daysInMonth;
		const projectedNet = monthIncome - projectedExpenses;
		const dailyBudgetLeft = daysLeft > 0 ? monthNet / daysLeft : 0;

		return {
			monthIncome, monthExpenses, monthNet, savingsRate,
			projectedExpenses, projectedNet, dailyBudgetLeft, daysLeft, dayOfMonth
		};
	}

	exportToJSON(): string {
		return this.repository.serialize(this.persistenceState());
	}

	previewImport(json: string): BackupPreview {
		try {
			const state = this.repository.deserialize(json, this.settings);
			const preview = previewBackup(json);
			return { ...preview, valid: true, version: state.version };
		} catch (error) {
			return { valid: false, error: error instanceof Error ? error.message : 'Archivo inválido.' };
		}
	}

	importFromJSON(json: string): boolean {
		try {
			const backup = this.repository.deserialize(json, this.settings);
			const categories = backup.categories;
			const accountIds = new Set(backup.accounts.map(account => account.id));
			const categoryIds = new Set(categories.map(category => category.id));

			if (new Set(backup.accounts.map(account => account.id)).size !== backup.accounts.length) {
				throw new Error('Las cuentas del backup tienen identificadores duplicados.');
			}
			if (new Set(categories.map(category => category.id)).size !== categories.length) {
				throw new Error('Las categorías del backup tienen identificadores duplicados.');
			}

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

			// La validación termina antes de mutar la interfaz y el snapshot se
			// persiste como una sola unidad; no quedan restauraciones parciales.
			this.accountsStore.data = backup.accounts;
			this.categoriesStore.data = categories;
			this.transactionsStore.data = backup.transactions;
			this.goalsStore.data = backup.goals;
			this.budgetsStore.data = backup.budgets;
			this.debtsStore.data = backup.debts;
			this.recurringStore.data = backup.recurringTransactions;
			// Un respaldo puede incluir historia corregida: sus cierres se regeneran
			// con los datos restaurados en lugar de conservar cifras potencialmente viejas.
			if (backup.settings) this.settingsStore.data = { ...backup.settings, netWorthSnapshots: [] };
			else this.settingsStore.updateSettings({ netWorthSnapshots: [] });

			this.migrateInitialBalances();
			this.recalculateBalances();
			this.recoveryRequired = false;
			this.persistenceStatus = 'saved';
			this.persistenceError = undefined;
			this.scheduleAutomaticBackup();
			return true;
		} catch (e) {
			console.error('Import failed', e);
			return false;
		}
	}
	// === Settings ===
	updateSettings(newData: Partial<Settings>) {
		const requestedBaseCurrency = newData.baseCurrency?.trim().toUpperCase() ?? this.settings.baseCurrency;
		const isChangingBaseCurrency = requestedBaseCurrency !== this.settings.baseCurrency;
		const candidate = {
			...this.settings,
			...newData,
			baseCurrency: requestedBaseCurrency,
			// Las tasas solo son válidas respecto de una base concreta; nunca se reinterpretan.
			exchangeRates: isChangingBaseCurrency ? {} : (newData.exchangeRates ?? this.settings.exchangeRates),
			exchangeRatesUpdatedAt: isChangingBaseCurrency ? undefined : (newData.exchangeRatesUpdatedAt ?? this.settings.exchangeRatesUpdatedAt)
		};
		if (isChangingBaseCurrency && (this.transactions.length > 0 || this.goals.length > 0 || this.debts.length > 0 || this.accounts.some((account) => (account.initialBalance ?? 0) !== 0 || Boolean(account.currency)))) {
			toastStore.add('No puedes cambiar la moneda base mientras existan datos. Crea un backup y migra explícitamente tus importes.', 'error');
			return false;
		}
		const parsed = SettingsSchema.safeParse(candidate);
		if (!parsed.success) { toastStore.add('La configuración no es válida.', 'error'); return false; }
		const missingRate = this.accounts.find((account) => account.currency && account.currency.toUpperCase() !== parsed.data.baseCurrency && !parsed.data.exchangeRates[account.currency.toUpperCase()]);
		if (missingRate) { toastStore.add(`No puedes quitar la tasa de ${missingRate.currency} mientras exista esa cuenta.`, 'error'); return false; }
		this.settingsStore.updateSettings(parsed.data);
		this.scheduleAutomaticBackup();
		return true;
	}

	formatCurrency(amount: number, currencyCode?: string): string {
		return formatCurrency(amount, currencyCode);
	}
}

export const financeStore = new FinanceStoreFacade();
