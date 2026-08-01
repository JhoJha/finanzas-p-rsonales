import type { Debt, Transaction } from '$lib/schema';

export class DebtService {
	static canApplyPayment(debts: Debt[], transaction: Transaction): boolean {
		if (!transaction.debtId) return true;
		const debt = debts.find((item) => item.id === transaction.debtId);
		const amount = transaction.linkedAmount ?? transaction.amount;
		const expectedType = debt?.type === 'i_owe' ? 'expense' : 'income';
		return Boolean(debt && debt.status === 'pending' && transaction.type === expectedType && Number.isFinite(amount) && amount > 0 && amount <= debt.totalAmount - debt.paidAmount + 0.000001);
	}

	static applyPayment(debts: Debt[], transaction: Transaction, multiplier: number): Debt[] {
		if (!transaction.debtId) return debts;
		const amount = transaction.linkedAmount ?? transaction.amount;
		return debts.map((debt) => {
			if (debt.id !== transaction.debtId) return debt;
			const paidAmount = Math.min(debt.totalAmount, Math.max(0, debt.paidAmount + amount * multiplier));
			return { ...debt, paidAmount, status: paidAmount === debt.totalAmount ? 'paid' : 'pending' };
		});
	}
}
