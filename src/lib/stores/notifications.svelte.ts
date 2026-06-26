import type { AppNotification } from '$contracts/backend';
import { listNotifications } from '$lib/api/notifications';

class NotificationStore {
	items = $state<AppNotification[]>([]);
	loaded = $state(false);

	get unreadCount(): number {
		return this.items.filter((n) => n.read_at === null).length;
	}

	async refresh() {
		const data = await listNotifications({ limit: 50 });
		this.items = data.items;
		this.loaded = true;
	}

	markRead(id: string) {
		this.items = this.items.map((n) =>
			n.id === id && n.read_at === null ? { ...n, read_at: new Date().toISOString() } : n
		);
	}

	markAllRead() {
		const now = new Date().toISOString();
		this.items = this.items.map((n) => (n.read_at === null ? { ...n, read_at: now } : n));
	}
}

export const notifications = new NotificationStore();
