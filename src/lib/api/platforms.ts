import type { Platform } from '$contracts/backend';
import { apiFetch } from './client';

interface PlatformListResponse {
	items: Platform[];
}

export interface CreatePlatformInput {
	key: string;
	label: string;
	icon: string;
	tone: string;
	sort_order: number;
	is_active: boolean;
}

export interface UpdatePlatformInput {
	label: string;
	icon: string;
	tone: string;
	sort_order: number;
	is_active: boolean;
}

export function listPlatforms(includeInactive = false) {
	return apiFetch<PlatformListResponse>('/platforms', {
		query: includeInactive ? { include_inactive: true } : undefined
	});
}

export function createPlatform(body: CreatePlatformInput) {
	return apiFetch<Platform>('/platforms', { method: 'POST', body });
}

export function updatePlatform(key: string, body: UpdatePlatformInput) {
	return apiFetch<Platform>(`/platforms/${encodeURIComponent(key)}`, { method: 'PATCH', body });
}

export function deletePlatform(key: string) {
	return apiFetch<void>(`/platforms/${encodeURIComponent(key)}`, { method: 'DELETE' });
}
