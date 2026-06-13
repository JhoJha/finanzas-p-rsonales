export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
}

export class ToastStore {
	toasts = $state<Toast[]>([]);

	add(message: string, type: ToastType = 'success', durationMs = 2500) {
		const id = crypto.randomUUID();
		this.toasts.push({ id, message, type });

		setTimeout(() => {
			this.remove(id);
		}, durationMs);
	}

	remove(id: string) {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}
}

export const toastStore = new ToastStore();
