export type ToastTone = 'info' | 'success' | 'error';

export interface ToastAction {
	label: string;
	onClick: () => void | Promise<void>;
}

export interface ToastInput {
	title?: string;
	message: string;
	tone?: ToastTone;
	duration?: number;
	action?: ToastAction;
}

export interface ToastItem extends ToastInput {
	id: number;
	tone: ToastTone;
	duration: number;
}

class ToastStore {
	items = $state<ToastItem[]>([]);
	private nextID = 1;
	private timers = new Map<number, number>();

	push(input: ToastInput): number {
		const id = this.nextID++;
		const item: ToastItem = {
			id,
			title: input.title?.trim() || undefined,
			message: input.message,
			tone: input.tone ?? 'info',
			duration: input.duration ?? 4000,
			action: input.action
		};
		this.items = [...this.items, item];

		if (item.duration > 0) {
			const timer = window.setTimeout(() => this.dismiss(id), item.duration);
			this.timers.set(id, timer);
		}

		return id;
	}

	dismiss(id: number) {
		const timer = this.timers.get(id);
		if (timer) {
			window.clearTimeout(timer);
			this.timers.delete(id);
		}
		this.items = this.items.filter((item) => item.id !== id);
	}

	clear() {
		for (const timer of this.timers.values()) {
			window.clearTimeout(timer);
		}
		this.timers.clear();
		this.items = [];
	}
}

export const toasts = new ToastStore();

export function pushToast(
	message: string,
	tone: ToastTone = 'info',
	duration = 4000,
	action?: ToastAction,
	title?: string
): number {
	return toasts.push({ message, tone, duration, action, title });
}
