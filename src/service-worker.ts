/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE_NAME = `pqmedia-${version}`;
const SHELL_URL = '/';
const PRECACHE: string[] = [...new Set([...build, ...files, SHELL_URL])];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			await Promise.allSettled(PRECACHE.map((asset) => cache.add(asset)));
		})()
	);
	void sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') void sw.skipWaiting();
});

interface PushPayload {
	title?: string;
	body?: string;
	tag?: string;
	url?: string;
	data?: Record<string, unknown>;
}

sw.addEventListener('push', (event) => {
	if (!event.data) return;
	const payload = event.data.json() as PushPayload;
	event.waitUntil(showPushNotification(payload));
});

async function showPushNotification(payload: PushPayload) {
	const clientList = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
	for (const client of clientList) {
		client.postMessage({ type: 'PUSH_RECEIVED', payload });
	}
	const title = payload.title ?? 'PQ Media';
	const options: NotificationOptions = {
		body: payload.body ?? '',
		tag: payload.tag,
		icon: '/icons/icon-192.png',
		badge: '/icons/icon-192.png',
		data: { url: payload.url, ...payload.data }
	};
	try {
		await sw.registration.showNotification(title, options);
	} catch {
		await sw.registration.showNotification(title, { body: options.body });
	}
}

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = String(event.notification.data?.url ?? '/');
	event.waitUntil(focusOrOpen(target));
});

async function focusOrOpen(target: string) {
	const url = new URL(target, sw.location.origin);
	const clientList = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
	for (const client of clientList) {
		if (new URL(client.url).pathname === url.pathname) {
			client.postMessage({ type: 'PUSH_CLICKED', url: target });
			return client.focus();
		}
	}
	return sw.clients.openWindow(url.toString());
}

sw.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	const sameOrigin = url.origin === sw.location.origin;

	if (request.mode === 'navigate') {
		event.respondWith(networkFirstWithShell(request));
		return;
	}

	if (!sameOrigin) return;

	if (build.includes(url.pathname) || files.includes(url.pathname)) {
		event.respondWith(cacheFirst(request));
	}
});

async function networkFirstWithShell(request: Request): Promise<Response> {
	try {
		const response = await fetch(request);
		if (response.ok) {
			const copy = response.clone();
			caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, copy));
		}
		return response;
	} catch {
		const cache = await caches.open(CACHE_NAME);
		return (await cache.match(SHELL_URL)) ?? Response.error();
	}
}

async function cacheFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE_NAME);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (response.ok) cache.put(request, response.clone());
	return response;
}
