import { describe, expect, it } from 'vitest';
import { FinanceStoreFacade } from '$lib/store.svelte';
import { createDebt, createFinanceState, createGoal, createRecurringDebtPayment, createTransaction } from '$lib/test/factories';

describe('servicios de entidades vinculadas', () => {
	it('aplica el mismo abono al aprobar, eliminar y deshacer un recurrente', () => {
		const store = new FinanceStoreFacade();
		store.hydrateState(createFinanceState({ debts: [createDebt()], recurringTransactions: [createRecurringDebtPayment()] }));

		const pending = store.getPendingRecurringTransactions()[0];
		store.approvePendingRecurring(pending.rtId, pending.tx, true);
		expect(store.debts[0].paidAmount).toBe(100);
		expect(store.deleteTransaction(pending.tx.id)).toBe(true);
		expect(store.debts[0].paidAmount).toBe(0);
		expect(store.restoreLastDeletedTransaction()).toBe(true);
		expect(store.debts[0].paidAmount).toBe(100);
	});

	it('aplica un aporte a meta una sola vez y lo revierte al eliminarlo', () => {
		const store = new FinanceStoreFacade();
		store.hydrateState(createFinanceState({ goals: [createGoal()] }));

		expect(store.contributeToGoal('goal', 100, 'cash')).toBe(true);
		expect(store.goals[0].currentAmount).toBe(100);
		const transactionId = store.transactions[0].id;
		expect(store.deleteTransaction(transactionId)).toBe(true);
		expect(store.goals[0].currentAmount).toBe(0);
		expect(store.restoreLastDeletedTransaction()).toBe(true);
		expect(store.goals[0].currentAmount).toBe(100);
	});

	it('guarda un lote de voz de forma atómica, evita repetirlo y permite deshacerlo', () => {
		const store = new FinanceStoreFacade();
		store.hydrateState(createFinanceState());
		const batch = [
			createTransaction({ id: 'voice-1', amount: 30 }),
			createTransaction({ id: 'voice-2', amount: 12, categoryId: '2' })
		];

		expect(store.addTransactionBatch(batch, 'voice-operation-1')).toBe(true);
		expect(store.transactions).toHaveLength(2);
		expect(store.accounts[0].balance).toBe(458);
		expect(store.addTransactionBatch(batch, 'voice-operation-1')).toBe(false);
		expect(store.undoLastAddedTransactionBatch()).toBe(true);
		expect(store.transactions).toHaveLength(0);
		expect(store.accounts[0].balance).toBe(500);
	});

	it('no aplica parcialmente un lote inválido', () => {
		const store = new FinanceStoreFacade();
		store.hydrateState(createFinanceState());
		const batch = [
			createTransaction({ id: 'valid-voice', amount: 30 }),
			createTransaction({ id: 'invalid-voice', accountId: 'does-not-exist', amount: 12 })
		];

		expect(store.addTransactionBatch(batch, 'voice-operation-invalid')).toBe(false);
		expect(store.transactions).toHaveLength(0);
		expect(store.accounts[0].balance).toBe(500);
	});
});
