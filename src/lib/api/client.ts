import type { ApiErrorResponse, RefreshRequest, TokenPair } from '$contracts/backend';
import { API_BASE } from '$lib/env';
import { auth } from '$lib/stores/auth.svelte';

export class ApiError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

export interface ApiOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	body?: unknown;
	query?: Record<string, string | number | boolean | undefined | null>;
	headers?: Record<string, string>;
	signal?: AbortSignal;
	/** When true, never attach the Bearer token. Default false. */
	skipAuth?: boolean;
}

/** Issue an authenticated JSON request to the BE. Retries once on 401 after refreshing. */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
	const url = buildUrl(path, options.query);
	const response = await sendRequest(url, options, auth.accessToken);

	if (response.status !== 401 || options.skipAuth) {
		return parseOrThrow<T>(response);
	}

	const refreshed = await tryRefreshToken();
	if (!refreshed) {
		auth.clear();
		throw await toApiError(response);
	}

	const retry = await sendRequest(url, options, refreshed.access_token);
	return parseOrThrow<T>(retry);
}

function buildUrl(path: string, query?: ApiOptions['query']): string {
	const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value === undefined || value === null || value === '') continue;
			url.searchParams.set(key, String(value));
		}
	}
	return url.toString();
}

async function sendRequest(
	url: string,
	options: ApiOptions,
	token: string | null
): Promise<Response> {
	const headers = new Headers(options.headers);
	headers.set('Accept', 'application/json');
	if (!options.skipAuth && token) {
		headers.set('Authorization', `Bearer ${token}`);
	}

	const init: RequestInit = {
		method: options.method ?? 'GET',
		headers,
		signal: options.signal
	};
	if (options.body !== undefined) {
		headers.set('Content-Type', 'application/json');
		init.body = JSON.stringify(options.body);
	}

	return fetch(url, init);
}

async function parseOrThrow<T>(response: Response): Promise<T> {
	if (response.status === 204) {
		return undefined as T;
	}
	if (!response.ok) {
		throw await toApiError(response);
	}
	return (await response.json()) as T;
}

async function toApiError(response: Response): Promise<ApiError> {
	try {
		const payload = (await response.json()) as ApiErrorResponse;
		return new ApiError(
			response.status,
			payload.error?.code ?? 'unknown',
			payload.error?.message ?? response.statusText
		);
	} catch {
		return new ApiError(response.status, 'unknown', response.statusText);
	}
}

let refreshInFlight: Promise<TokenPair | null> | null = null;

/** Single-flight refresh: concurrent 401s share one refresh attempt. */
function tryRefreshToken(): Promise<TokenPair | null> {
	const token = auth.session?.refreshToken;
	if (!token) return Promise.resolve(null);

	if (!refreshInFlight) {
		refreshInFlight = refreshOnce(token).finally(() => {
			refreshInFlight = null;
		});
	}
	return refreshInFlight;
}

async function refreshOnce(refreshToken: string): Promise<TokenPair | null> {
	const body: RefreshRequest = { refresh_token: refreshToken };
	const response = await fetch(`${API_BASE}/auth/refresh`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(body)
	});
	if (!response.ok) return null;
	const tokens = (await response.json()) as TokenPair;
	auth.updateTokens(tokens);
	return tokens;
}
