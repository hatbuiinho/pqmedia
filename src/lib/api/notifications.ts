import type { AppNotification } from '$contracts/backend';
import { apiFetch } from './client';

interface NotificationListResponse {
	items: AppNotification[];
	unread_count: number;
}

export function listNotifications(params: { unread?: boolean; limit?: number } = {}) {
	const query: Record<string, string | number | undefined> = { limit: params.limit };
	if (params.unread) query.unread = 'true';
	return apiFetch<NotificationListResponse>('/notifications', { query });
}

export function markNotificationRead(id: string) {
	return apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' });
}

export function markAllNotificationsRead() {
	return apiFetch<void>('/notifications/read-all', { method: 'POST' });
}
