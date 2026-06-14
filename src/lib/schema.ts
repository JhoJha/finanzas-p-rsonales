import { z } from 'zod';

/** IDs de categorías internas del sistema (no editables por el usuario) */
export const INTERNAL_CATEGORY_DEBT_PAYMENT = '__debt-payment__';
export const INTERNAL_CATEGORY_SAVINGS = '__savings__';

export const CategorySchema = z.object({
	id: z.string(),
	name: z.string(),
	icon: z.string(),
	color: z.string(),
	type: z.enum(['expense', 'income'])
});

export const AccountSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.enum(['cash', 'bank', 'credit']),
	balance: z.number(),
	color: z.string().optional()
});

export const TransactionSchema = z.object({
	id: z.string(),
	date: z.string(),
	amount: z.number(),
	categoryId: z.string(),
	accountId: z.string(),
	toAccountId: z.string().optional(),
	note: z.string().optional(),
	type: z.enum(['expense', 'income', 'transfer'])
});

export const GoalSchema = z.object({
	id: z.string(),
	name: z.string(),
	targetAmount: z.number(),
	currentAmount: z.number(),
	deadline: z.string().optional()
});

export const BudgetSchema = z.object({
	id: z.string(),
	categoryId: z.string(),
	amount: z.number(),
	period: z.enum(['monthly'])
});

export const RecurringTransactionSchema = z.object({
	id: z.string(),
	amount: z.number(),
	categoryId: z.string(),
	accountId: z.string(),
	toAccountId: z.string().optional(),
	note: z.string().optional(),
	type: z.enum(['expense', 'income', 'transfer']),
	frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
	nextDate: z.string()
});

export const DebtSchema = z.object({
	id: z.string(),
	type: z.enum(['i_owe', 'owed_to_me']),
	contactName: z.string(),
	totalAmount: z.number(),
	paidAmount: z.number(),
	dueDate: z.string().optional(), // ISO date
	status: z.enum(['pending', 'paid']),
	accountId: z.string().optional() // Default account for related transactions
});

export type Category = z.infer<typeof CategorySchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type RecurringTransaction = z.infer<typeof RecurringTransactionSchema>;
export type Debt = z.infer<typeof DebtSchema>;

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
