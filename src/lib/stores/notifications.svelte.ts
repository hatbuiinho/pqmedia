import type { AppNotification } from '$contracts/backend';
import { listNotifications } from '$lib/api/notifications';

class NotificationStore {
	items = $state<AppNotification[]>([]);
	loaded = $state(false);
	unreadCount = $state(0);

	async refresh() {
		const data = await listNotifications({ limit: 50 });
		this.items = data.items;
		this.unreadCount = data.unread_count;
		this.loaded = true;
	}

	markRead(id: string) {
		const target = this.items.find((n) => n.id === id);
		this.items = this.items.map((n) =>
			n.id === id && n.read_at === null ? { ...n, read_at: new Date().toISOString() } : n
		);
		if (target && target.read_at === null) {
			this.unreadCount = Math.max(0, this.unreadCount - 1);
		}
	}

	markAllRead() {
		const now = new Date().toISOString();
		this.items = this.items.map((n) => (n.read_at === null ? { ...n, read_at: now } : n));
		this.unreadCount = 0;
	}

	increaseUnread(by = 1) {
		this.unreadCount = Math.max(0, this.unreadCount + by);
	}
}

export const notifications = new NotificationStore();
