import type { LoginRequest, LoginResponse, Principal, TokenPair } from '$contracts/backend';
import { apiFetch } from './client';
import { auth } from '$lib/stores/auth.svelte';

export async function login(body: LoginRequest): Promise<LoginResponse> {
	const data = await apiFetch<LoginResponse>('/auth/login', {
		method: 'POST',
		body,
		skipAuth: true
	});
	auth.setSession({
		principal: data.principal,
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		accessExpiresAt: data.access_expires_at
	});
	return data;
}

export async function logout(): Promise<void> {
	try {
		await apiFetch<void>('/auth/logout', { method: 'POST' });
	} finally {
		auth.clear();
	}
}

export async function fetchMe(): Promise<Principal> {
	const principal = await apiFetch<Principal>('/me');
	auth.updatePrincipal(principal);
	return principal;
}

export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
	const tokens = await apiFetch<TokenPair>('/auth/refresh', {
		method: 'POST',
		body: { refresh_token: refreshToken },
		skipAuth: true
	});
	auth.updateTokens(tokens);
	return tokens;
}
