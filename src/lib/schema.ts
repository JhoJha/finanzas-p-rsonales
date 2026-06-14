import { z } from 'zod';

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
	frequency: z.enum(['daily', 'weekly', 'monthly']),
	nextDate: z.string()
});

export type Category = z.infer<typeof CategorySchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type RecurringTransaction = z.infer<typeof RecurringTransactionSchema>;

export const defaultCategories: Category[] = [
	{ id: '1', name: 'Alimentación', icon: 'pizza', color: 'bg-orange-500', type: 'expense' },
	{ id: '2', name: 'Transporte', icon: 'bus', color: 'bg-blue-500', type: 'expense' },
	{ id: '3', name: 'Vivienda', icon: 'home', color: 'bg-green-500', type: 'expense' },
	{ id: '4', name: 'Educación', icon: 'graduation-cap', color: 'bg-purple-500', type: 'expense' },
	{ id: '5', name: 'Ocio', icon: 'gamepad-2', color: 'bg-pink-500', type: 'expense' },
	{ id: '6', name: 'Trabajo / Ingresos', icon: 'briefcase', color: 'bg-yellow-500', type: 'income' }
];
