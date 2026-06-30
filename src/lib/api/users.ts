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

export interface UpdateUserInput {
	full_name: string;
	phone?: string | null;
	is_admin: boolean;
	is_active: boolean;
}

export interface ResetUserPasswordInput {
	current_password?: string;
	password: string;
}

export function listUsers(params: { q?: string; limit?: number; offset?: number } = {}) {
	return apiFetch<PageResponse<Principal>>('/users', { query: params });
}

export function createUser(body: CreateUserInput) {
	return apiFetch<Principal>('/users', { method: 'POST', body });
}

export function updateUser(userID: string, body: UpdateUserInput) {
	return apiFetch<Principal>(`/users/${userID}`, { method: 'PATCH', body });
}

export function resetUserPassword(userID: string, body: ResetUserPasswordInput) {
	return apiFetch<void>(`/users/${userID}/reset-password`, { method: 'POST', body });
}

export function updateOwnProfile(body: UpdateProfileInput) {
	return apiFetch<Principal>('/me/profile', { method: 'PATCH', body });
}

export function changeOwnPassword(body: ResetUserPasswordInput) {
	return apiFetch<void>('/me/change-password', { method: 'POST', body });
}
