import type { PageResponse, Principal } from '$contracts/backend';
import { apiFetch } from './client';

export interface CreateUserInput {
	email: string;
	password: string;
	full_name: string;
	phone?: string | null;
	is_admin?: boolean;
}

export interface UpdateProfileInput {
	full_name: string;
	phone?: string | null;
}

export function listUsers(params: { q?: string; limit?: number; offset?: number } = {}) {
	return apiFetch<PageResponse<Principal>>('/users', { query: params });
}

export function createUser(body: CreateUserInput) {
	return apiFetch<Principal>('/users', { method: 'POST', body });
}

export function updateOwnProfile(body: UpdateProfileInput) {
	return apiFetch<Principal>('/me/profile', { method: 'PATCH', body });
}
