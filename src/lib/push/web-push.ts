// Browser-side helpers around the Push API: subscribe / sync / unsubscribe.
// All functions are no-ops in non-secure or unsupported contexts.

import {
	disablePushSubscription,
	fetchVapidPublicKey,
	upsertPushSubscription
} from '$lib/api/push';

export type PushSupportState = 'unsupported' | 'insecure' | 'ready';
const serviceWorkerPath = '/service-worker.js';

export function pushSupportState(): PushSupportState {
	if (typeof window === 'undefined') return 'unsupported';
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
	if (!window.isSecureContext && window.location.hostname !== 'localhost') return 'insecure';
	return 'ready';
}

export async function currentPermission(): Promise<NotificationPermission> {
	if (typeof Notification === 'undefined') return 'denied';
	return Notification.permission;
}

export async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
	if (pushSupportState() !== 'ready') return null;
	const existing =
		(await navigator.serviceWorker.getRegistration(serviceWorkerPath)) ??
		(await navigator.serviceWorker.getRegistration());
	if (existing) return existing;
	return navigator.serviceWorker.register(serviceWorkerPath);
}

export async function enableWebPush(deviceLabel?: string): Promise<void> {
	if (pushSupportState() !== 'ready') throw new Error('Trình duyệt không hỗ trợ push');

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') throw new Error('Bạn chưa cấp quyền thông báo');

	const registration =
		(await ensureServiceWorkerRegistration()) ?? (await navigator.serviceWorker.ready);
	const { public_key } = await fetchVapidPublicKey();
	const subscription =
		(await registration.pushManager.getSubscription()) ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource
		}));
	await upsertPushSubscription(subscriptionToInput(subscription, deviceLabel));
}

export async function disableWebPush(): Promise<void> {
	if (pushSupportState() !== 'ready') return;
	const registration =
		(await ensureServiceWorkerRegistration()) ?? (await navigator.serviceWorker.ready);
	const subscription = await registration.pushManager.getSubscription();
	if (!subscription) return;
	try {
		await disablePushSubscription(subscription.endpoint);
	} finally {
		await subscription.unsubscribe();
	}
}

export async function isWebPushActive(): Promise<boolean> {
	if (pushSupportState() !== 'ready') return false;
	try {
		return (await getCurrentPushSubscription()) !== null;
	} catch {
		return false;
	}
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
	if (pushSupportState() !== 'ready') return null;
	const registrations = await navigator.serviceWorker.getRegistrations();
	for (const registration of registrations) {
		try {
			const subscription = await registration.pushManager.getSubscription();
			if (subscription) return subscription;
		} catch {
			continue;
		}
	}
	const registration =
		(await ensureServiceWorkerRegistration()) ?? (await navigator.serviceWorker.ready);
	return registration.pushManager.getSubscription();
}

export async function syncCurrentPushSubscription(deviceLabel?: string): Promise<boolean> {
	if (pushSupportState() !== 'ready') return false;
	const subscription = await getCurrentPushSubscription();
	if (!subscription) return false;
	await upsertPushSubscription(subscriptionToInput(subscription, deviceLabel));
	return true;
}

function subscriptionToInput(sub: PushSubscription, deviceLabel?: string) {
	const json = sub.toJSON();
	return {
		endpoint: sub.endpoint,
		p256dh: json.keys?.p256dh ?? '',
		auth: json.keys?.auth ?? '',
		user_agent: navigator.userAgent,
		device_label: deviceLabel
	};
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(normalized);
	const buffer = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i);
	return buffer;
}
