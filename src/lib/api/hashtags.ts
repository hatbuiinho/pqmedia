import { apiFetch } from './client';

export interface ManagedHashtag {
	id: string;
	name: string;
	post_count: number;
	unpublished_post_count: number;
}

interface ManagedHashtagListResponse {
	items: ManagedHashtag[];
}

export function listManagedHashtags(q?: string, limit?: number) {
	return apiFetch<ManagedHashtagListResponse>('/hashtags/manage', {
		query: { q, limit }
	});
}

export function createHashtag(name: string) {
	return apiFetch<ManagedHashtag>('/hashtags', {
		method: 'POST',
		body: { name }
	});
}

export function updateHashtag(currentName: string, name: string) {
	return apiFetch<ManagedHashtag>(`/hashtags/${encodeURIComponent(currentName)}`, {
		method: 'PATCH',
		body: { name }
	});
}

export function deleteHashtag(name: string) {
	return apiFetch<void>(`/hashtags/${encodeURIComponent(name)}`, {
		method: 'DELETE'
	});
}
