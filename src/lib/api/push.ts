import type { PushSubscriptionInput } from '$contracts/backend';
import { apiFetch } from './client';

interface VapidResponse {
	public_key: string;
}

export function fetchVapidPublicKey() {
	return apiFetch<VapidResponse>('/push/vapid-public-key');
}

export function upsertPushSubscription(body: PushSubscriptionInput) {
	return apiFetch<void>('/push-subscriptions', { method: 'POST', body });
}

export function disablePushSubscription(endpoint: string) {
	return apiFetch<void>('/push-subscriptions', { method: 'DELETE', body: { endpoint } });
}
