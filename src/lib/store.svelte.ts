import { type Category, type Transaction, type Goal, type Account, type Budget, type RecurringTransaction, type Debt, type Settings, type ImportRow, INTERNAL_CATEGORY_DEBT_PAYMENT, INTERNAL_CATEGORY_SAVINGS, TransactionSchema } from './schema';
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
import { getExchangeRateToBase, projectDebtRepayment, transactionAmountInBase } from './utils/finance';
import { parseAndValidateBackup, previewBackup, type BackupPreview } from './utils/backup';
import { loadFromStorage, saveToStorage, loadFinanceSnapshot, saveFinanceSnapshot } from './stores/storage';
import { calculateCashForecast, detectSubscriptions } from './utils/forecast';

export type Period = 'all' | 'today' | 'week' | 'month' | 'year' | string;

class FinanceStoreFacade {
	private accountsStore = new AccountsStore();
	private transactionsStore = new TransactionsStore();
	private categoriesStore = new CategoriesStore();
	private goalsStore = new GoalsStore();
	private budgetsStore = new BudgetsStore();
	private debtsStore = new DebtsStore();
	private recurringStore = new RecurringStore();
	private settingsStore = new SettingsStore();

	isReady = $state(false);
	private lastDeletedTransaction: Transaction | null = null;
	private backupTimer: ReturnType<typeof setTimeout> | undefined;
	private persistenceQueue: Promise<void> = Promise.resolve();

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
		// Desde P6, el estado consolidado es la fuente de verdad. Las claves
		// individuales se conservan solo para migrar instalaciones anteriores.
		const snapshot = await loadFinanceSnapshot();
		if (snapshot) {
			try {
				const restored = parseAndValidateBackup(JSON.stringify(snapshot));
				this.accountsStore.data = restored.accounts;
				this.transactionsStore.data = restored.transactions;
				this.categoriesStore.data = restored.categories;
				this.goalsStore.data = restored.goals;
				this.budgetsStore.data = restored.budgets;
				this.debtsStore.data = restored.debts;
				this.recurringStore.data = restored.recurringTransactions;
				if (restored.settings) this.settingsStore.data = restored.settings;
			} catch (error) {
				console.error('Ignoring invalid consolidated finance state', error);
			}
		}
		
		this.migrateInitialBalances();
		this.recalculateBalances();
		// Recurring txs are no longer processed automatically, user must approve them
		
		this.isReady = true;
	}

	recalculateBalances() {
		this.accountsStore.data.forEach(a => {
			this.accountsStore.setBalance(a.id, a.initialBalance ?? 0);
		});
		
		this.transactionsStore.data.forEach(t => {
			this.applyTransactionEffect(t, 1);
		});
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

		if (migrated) this.accountsStore.save();
	}

	private applyTransactionEffect(t: Transaction, multiplier: number) {
		if (t.type === 'income') {
			this.accountsStore.updateBalance(t.accountId, t.amount * multiplier);
		} else if (t.type === 'expense') {
			this.accountsStore.updateBalance(t.accountId, -t.amount * multiplier);
		} else if (t.type === 'transfer' && t.toAccountId) {
			this.accountsStore.updateBalance(t.accountId, -t.amount * multiplier);
			this.accountsStore.updateBalance(t.toAccountId, (t.toAmount ?? t.amount) * multiplier);
		}
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

	private persistState() {
		if (!browser) return;
		const snapshot = {
			transactions: $state.snapshot(this.transactionsStore.data), categories: $state.snapshot(this.categoriesStore.data),
			goals: $state.snapshot(this.goalsStore.data), accounts: $state.snapshot(this.accountsStore.data),
			budgets: $state.snapshot(this.budgetsStore.data), recurringTransactions: $state.snapshot(this.recurringStore.data),
			debts: $state.snapshot(this.debtsStore.data), settings: $state.snapshot(this.settingsStore.data)
		};
		this.persistenceQueue = this.persistenceQueue
			.then(() => saveFinanceSnapshot(snapshot))
			.catch((error) => console.error('Could not persist finance state', error));
	}

	private scheduleAutomaticBackup() {
		if (!browser) return;
		this.persistState();
		if (this.backupTimer) clearTimeout(this.backupTimer);
		this.backupTimer = setTimeout(async () => {
			const snapshot = JSON.parse(this.exportToJSON());
			const history = await loadFromStorage<any[]>('finances_backup_history', []);
			await saveToStorage('finances_backup_history', [snapshot, ...history].slice(0, 5));
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

	// === Transactions ===
	addTransaction(transaction: Transaction): boolean {
		const parsed = TransactionSchema.safeParse(this.snapshotExchangeRate(transaction));
		if (!parsed.success || !this.accounts.some((account) => account.id === parsed.data.accountId) || (parsed.data.type === 'transfer' && (!parsed.data.toAccountId || parsed.data.toAccountId === parsed.data.accountId || !this.accounts.some((account) => account.id === parsed.data.toAccountId)))) {
			toastStore.add('La transacción no es válida.', 'error');
			return false;
		}
		this.transactionsStore.addTransaction(parsed.data);
		this.applyTransactionEffect(parsed.data, 1);
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
			const categoryId = row.categoryId ?? this.categories.find((category) => category.type === type && !category.id.startsWith('__'))?.id;
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
		this.scheduleAutomaticBackup();
		return true;
	}

	restoreLastDeletedTransaction(): boolean {
		if (!this.lastDeletedTransaction || this.transactions.some((transaction) => transaction.id === this.lastDeletedTransaction?.id)) return false;
		const transaction = this.lastDeletedTransaction;
		this.transactionsStore.addTransaction(transaction);
		this.applyTransactionEffect(transaction, 1);
		this.applyLinkedTransactionEffect(transaction, 1);
		this.lastDeletedTransaction = null;
		this.scheduleAutomaticBackup();
		return true;
	}

	private applyLinkedTransactionEffect(transaction: Transaction, multiplier: number) {
		if (transaction.debtId) {
			this.debtsStore.updateDebt(transaction.debtId, (debt) => {
				debt.paidAmount = Math.min(debt.totalAmount, Math.max(0, debt.paidAmount + (transaction.linkedAmount ?? transaction.amount) * multiplier));
				debt.status = debt.paidAmount === debt.totalAmount ? 'paid' : 'pending';
			});
		}
		if (transaction.goalId) {
			this.goalsStore.updateGoalProgress(transaction.goalId, (transaction.linkedAmount ?? transaction.amount) * multiplier);
			const goal = this.goals.find((item) => item.id === transaction.goalId);
			if (goal && goal.currentAmount < 0) this.goalsStore.updateGoalProgress(goal.id, -goal.currentAmount);
		}
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
		this.scheduleAutomaticBackup();
		return true;
	}

	// === Accounts ===
	addAccount(account: Account) {
		this.accountsStore.addAccount({
			...account,
			initialBalance: account.initialBalance ?? account.balance
		});
		this.scheduleAutomaticBackup();
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
		this.scheduleAutomaticBackup();
		return true;
		return true;
	}

	// === Goals ===
	addGoal(goal: Goal) { this.goalsStore.addGoal(goal); this.scheduleAutomaticBackup(); }
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
		this.goalsStore.updateGoalProgress(goalId, amount);
		this.scheduleAutomaticBackup();
		return true;
	}

	// === Budgets ===
	addBudget(budget: Budget) { this.budgetsStore.addBudget(budget); this.scheduleAutomaticBackup(); }
	deleteBudget(id: string) { this.budgetsStore.deleteBudget(id); this.scheduleAutomaticBackup(); }

	getBudgetProgress(identifier: string) {
		const budget = this.budgets.find((item) => item.id === identifier)
			?? this.budgets.find((item) => item.categoryId === identifier && item.period === 'monthly');
		if (!budget) return null;

		const now = new Date();
		const startDate = budget.period === 'weekly'
			? new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
			: new Date(now.getFullYear(), now.getMonth(), 1);
		const endDate = budget.period === 'weekly'
			? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6, 23, 59, 59, 999)
			: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
		const previousStart = budget.period === 'weekly'
			? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - 7)
			: new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const previousEnd = new Date(startDate.getTime() - 1);
		const start = startDate.getTime();
		const end = endDate.getTime();

		const spent = this.transactions
			.filter(t => t.type === 'expense' && t.categoryId === budget.categoryId && t.timestamp! >= start && t.timestamp! <= end)
			.reduce((acc, t) => {
				return acc + this.getTransactionAmountInBase(t);
			}, 0);
		const previousSpent = this.transactions
			.filter(t => t.type === 'expense' && t.categoryId === budget.categoryId && t.timestamp! >= previousStart.getTime() && t.timestamp! <= previousEnd.getTime())
			.reduce((acc, t) => acc + this.getTransactionAmountInBase(t), 0);
		const daysLeft = Math.max(0, Math.ceil((end - now.getTime()) / 86400000));
		const available = budget.amount - spent;

		return {
			id: budget.id,
			period: budget.period,
			budget: budget.amount,
			spent,
			previousSpent,
			available,
			daysLeft,
			dailyAvailable: daysLeft > 0 ? Math.max(0, available) / daysLeft : Math.max(0, available),
			percent: Math.round((spent / budget.amount) * 100),
			alertThreshold: budget.alertThreshold ?? this.settings.budgetAlertThreshold
		};
	}

	getBudgetAlerts() {
		return this.budgets.flatMap((budget) => {
			const progress = this.getBudgetProgress(budget.id);
			return progress && progress.percent >= progress.alertThreshold ? [{ budget, progress }] : [];
		});
	}

	// === Recurring ===
	addRecurringTransaction(rt: RecurringTransaction) { this.recurringStore.addRecurringTransaction(rt); this.scheduleAutomaticBackup(); }
	deleteRecurringTransaction(id: string) { this.recurringStore.deleteRecurringTransaction(id); this.scheduleAutomaticBackup(); }
	
	getPendingRecurringTransactions() {
		const now = new Date();
		const pending: { rtId: string; tx: Transaction }[] = [];
		this.recurringTransactions.forEach(rt => {
			let nextDate = dateFromDateOnly(rt.nextDate);
			while (nextDate <= now) {
				pending.push({
					rtId: rt.id,
					tx: {
						id: crypto.randomUUID(),
						date: nextDate.toISOString(),
						amount: rt.amount,
						categoryId: rt.categoryId,
						accountId: rt.accountId,
						toAccountId: rt.toAccountId,
						note: rt.note,
						type: rt.type
					}
				});
				
				if (rt.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
				else if (rt.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
				else if (rt.frequency === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
				else if (rt.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
			}
		});
		return pending;
	}

	approvePendingRecurring(rtId: string, tx: Transaction, accept: boolean) {
		const rt = this.recurringTransactions.find(r => r.id === rtId);
		if (!rt) return;
		
		if (accept) {
			this.addTransaction(tx);
		}
		
		let nextDate = dateFromDateOnly(tx.date);
		if (rt.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
		else if (rt.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
		else if (rt.frequency === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
		else if (rt.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
		
		// Ensure we don't go backwards if multiple are pending
		const currentNext = dateFromDateOnly(rt.nextDate);
		if (nextDate > currentNext) {
			this.recurringStore.updateRecurringTransactions(
				this.recurringTransactions.map(r => r.id === rtId ? { ...r, nextDate: formatDateOnly(nextDate) } : r)
			);
		}
	}

	// === Debts ===
	addDebt(debt: Debt) { this.debtsStore.addDebt(debt); this.scheduleAutomaticBackup(); }
	deleteDebt(id: string): boolean {
		if (this.transactions.some((transaction) => transaction.debtId === id)) {
			toastStore.add('No se puede eliminar una deuda con abonos registrados.', 'error');
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

		this.debtsStore.updateDebt(debtId, (currentDebt) => {
			currentDebt.paidAmount += amount;
			if (currentDebt.paidAmount === currentDebt.totalAmount) currentDebt.status = 'paid';
		});

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
		if (!created) {
			this.debtsStore.updateDebt(debtId, (currentDebt) => {
				currentDebt.paidAmount -= amount;
				currentDebt.status = 'pending';
			});
			return false;
		}
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

	// === Derived Summaries & Health ===
	get summary() {
		// Calculate converted totals
		let income = 0;
		let expenses = 0;
		
		this.transactions.forEach(t => {
			const convertedAmount = this.getTransactionAmountInBase(t);
			if (t.type === 'income') income += convertedAmount;
			else if (t.type === 'expense') expenses += convertedAmount;
		});

		const savings = this.goals.reduce((acc, g) => acc + g.currentAmount, 0); // Goals usually in base currency for now
		
		const balance = this.accounts.reduce((acc, a) => acc + a.balance * getExchangeRateToBase(a.currency, this.settings), 0);

		return { income, expenses, balance, savings };
	}

	getTransactionsByPeriod(period: Period): Transaction[] {
		const now = Date.now();
		let start = 0;

		if (typeof period === 'string' && period.includes('-')) {
			const [year, month] = period.split('-').map(Number);
			const startOfMonth = new Date(year, month - 1, 1).getTime();
			const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();
			return this.transactions.filter((t) => t.timestamp! >= startOfMonth && t.timestamp! <= endOfMonth);
		}

		const d = new Date();
		switch (period) {
			case 'today':
				d.setHours(0, 0, 0, 0);
				start = d.getTime();
				break;
			case 'week':
				d.setDate(d.getDate() - 7);
				start = d.getTime();
				break;
			case 'month':
				d.setMonth(d.getMonth() - 1);
				start = d.getTime();
				break;
			case 'year':
				d.setFullYear(d.getFullYear() - 1);
				start = d.getTime();
				break;
			default:
				return [...this.transactions];
		}

		return this.transactions.filter((t) => t.timestamp! >= start && t.timestamp! <= now);
	}

	getExpensesByCategory(period: Period = 'all') {
		const filtered = period === 'all' ? this.transactions : this.getTransactionsByPeriod(period);
		const expenses = filtered.filter((t) => t.type === 'expense' && t.categoryId !== 'transfer');

		const grouped: Record<string, number> = {};
		expenses.forEach((t) => {
			const convertedAmount = this.getTransactionAmountInBase(t);
			grouped[t.categoryId] = (grouped[t.categoryId] || 0) + convertedAmount;
		});

		const total = Object.values(grouped).reduce((a, b) => a + b, 0) || 1;

		return Object.entries(grouped)
			.map(([id, amount]) => {
				const cat = this.categories.find((c) => c.id === id);
				return {
					id,
					name: cat?.name || 'Otro',
					amount,
					color: cat?.color?.replace('bg-', '') || 'gray-500',
					percent: Math.round((amount / total) * 100)
				};
			})
			.sort((a, b) => b.amount - a.amount);
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
		return JSON.stringify({
			version: 4,
			transactions: this.transactions,
			categories: this.categories,
			goals: this.goals,
			accounts: this.accountsStore.data,
			budgets: this.budgets,
			recurringTransactions: this.recurringTransactions,
			debts: this.debts,
			settings: this.settings,
			exportedAt: new Date().toISOString()
		}, null, 2);
	}

	previewImport(json: string): BackupPreview {
		return previewBackup(json);
	}

	importFromJSON(json: string): boolean {
		try {
			const backup = parseAndValidateBackup(json);
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
			if (backup.settings) this.settingsStore.data = backup.settings;

			this.migrateInitialBalances();
			this.recalculateBalances();
			this.scheduleAutomaticBackup();
			return true;
		} catch (e) {
			console.error('Import failed', e);
			return false;
		}
	}
	// === Settings ===
	updateSettings(newData: Partial<Settings>) {
		this.settingsStore.updateSettings(newData);
		this.scheduleAutomaticBackup();
	}

	formatCurrency(amount: number, currencyCode?: string): string {
		return formatCurrency(amount, currencyCode);
	}
}

export const financeStore = new FinanceStoreFacade();
