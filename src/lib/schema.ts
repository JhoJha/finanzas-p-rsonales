import { z } from 'zod';

/** IDs de categorías internas del sistema (no editables por el usuario) */
export const INTERNAL_CATEGORY_DEBT_PAYMENT = '__debt-payment__';
export const INTERNAL_CATEGORY_SAVINGS = '__savings__';

const EntityId = z.string().trim().min(1);
const PositiveAmount = z.number().finite().positive();

export const CategorySchema = z.object({
	id: EntityId,
	name: z.string().trim().min(1),
	icon: z.string().trim().min(1),
	color: z.string().trim().min(1),
	type: z.enum(['expense', 'income'])
});

export const AccountSchema = z.object({
	id: EntityId,
	name: z.string().trim().min(1),
	type: z.enum(['cash', 'bank', 'credit']),
	// Saldo de apertura, independiente del saldo calculado por las transacciones.
	// Es opcional para poder migrar los datos creados antes de este campo.
	initialBalance: z.number().finite().optional(),
	balance: z.number().finite(),
	color: z.string().optional(),
	currency: z.string().optional()
});

export const SettingsSchema = z.object({
	baseCurrency: z.string().trim().min(3).max(3),
	exchangeRates: z.record(z.string(), z.number().finite().positive()),
	profile: z.object({
		name: z.string().default(''),
		avatar: z.string().default('👋'),
		usePhoto: z.boolean().default(false)
	}).optional()
});

export const TransactionSchema = z.object({
	id: EntityId,
	date: z.string().trim().min(1),
	timestamp: z.number().finite().optional(),
	amount: PositiveAmount,
	categoryId: EntityId,
	accountId: EntityId,
	toAccountId: EntityId.optional(),
	note: z.string().optional(),
	type: z.enum(['expense', 'income', 'transfer']),
	tags: z.array(z.string()).optional(),
	// Se capturan al crear el movimiento para que los reportes históricos no
	// cambien cuando el usuario actualiza sus tasas de cambio.
	exchangeRate: z.number().finite().positive().optional(),
	baseCurrency: z.string().trim().min(3).max(3).optional(),
	debtId: EntityId.optional(),
	goalId: EntityId.optional()
});

export const GoalSchema = z.object({
	id: EntityId,
	name: z.string().trim().min(1),
	targetAmount: PositiveAmount,
	currentAmount: z.number().finite().nonnegative(),
	deadline: z.string().optional()
});

export const BudgetSchema = z.object({
	id: EntityId,
	categoryId: EntityId,
	amount: PositiveAmount,
	period: z.enum(['monthly'])
});

export const RecurringTransactionSchema = z.object({
	id: EntityId,
	amount: PositiveAmount,
	categoryId: EntityId,
	accountId: EntityId,
	toAccountId: EntityId.optional(),
	note: z.string().optional(),
	type: z.enum(['expense', 'income', 'transfer']),
	frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
	nextDate: z.string()
});

export const DebtSchema = z.object({
	id: EntityId,
	type: z.enum(['i_owe', 'owed_to_me']),
	contactName: z.string().trim().min(1),
	totalAmount: PositiveAmount,
	paidAmount: z.number().finite().nonnegative(),
	dueDate: z.string().optional(), // ISO date
	status: z.enum(['pending', 'paid']),
	accountId: z.string().optional() // Default account for related transactions
}).refine((debt) => debt.paidAmount <= debt.totalAmount, {
	message: 'El monto abonado no puede superar el total de la deuda',
	path: ['paidAmount']
});

export const BackupSchema = z.object({
	version: z.number().int().positive().optional(),
	transactions: z.array(TransactionSchema),
	categories: z.array(CategorySchema),
	goals: z.array(GoalSchema),
	accounts: z.array(AccountSchema).min(1),
	budgets: z.array(BudgetSchema),
	recurringTransactions: z.array(RecurringTransactionSchema),
	debts: z.array(DebtSchema),
	settings: SettingsSchema.optional(),
	exportedAt: z.string().optional()
}).passthrough();

export type Category = z.infer<typeof CategorySchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type RecurringTransaction = z.infer<typeof RecurringTransactionSchema>;
export type Debt = z.infer<typeof DebtSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type FinanceBackup = z.infer<typeof BackupSchema>;

export const defaultCategories: Category[] = [
	{ id: '1', name: 'Alimentación', icon: 'pizza', color: 'bg-orange-500', type: 'expense' },
	{ id: '2', name: 'Transporte', icon: 'bus', color: 'bg-blue-500', type: 'expense' },
	{ id: '3', name: 'Vivienda', icon: 'home', color: 'bg-green-500', type: 'expense' },
	{ id: '4', name: 'Educación', icon: 'graduation-cap', color: 'bg-purple-500', type: 'expense' },
	{ id: '5', name: 'Ocio', icon: 'gamepad-2', color: 'bg-pink-500', type: 'expense' },
	{ id: '6', name: 'Trabajo / Ingresos', icon: 'briefcase', color: 'bg-yellow-500', type: 'income' },
	// Categorías internas del sistema — no se muestran al usuario en los selectores
	{ id: INTERNAL_CATEGORY_DEBT_PAYMENT, name: 'Pago de Deuda', icon: 'hand-coins', color: 'bg-amber-500', type: 'expense' },
	{ id: INTERNAL_CATEGORY_SAVINGS, name: 'Ahorro / Meta', icon: 'piggy-bank', color: 'bg-teal-500', type: 'expense' }
];
