import type { Principal, TokenPair } from '$contracts/backend';

const STORAGE_KEY = 'pqmedia.auth';

export interface AuthSession {
	principal: Principal;
	accessToken: string;
	refreshToken: string;
	accessExpiresAt: string;
}

class AuthStore {
	session = $state<AuthSession | null>(null);

	get isAuthenticated() {
		return this.session !== null;
	}

	get accessToken(): string | null {
		return this.session?.accessToken ?? null;
	}

	get principal(): Principal | null {
		return this.session?.principal ?? null;
	}

	setSession(session: AuthSession) {
		this.session = session;
		this.persist();
	}

	updateTokens(tokens: TokenPair) {
		if (!this.session) return;
		this.session = {
			...this.session,
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token,
			accessExpiresAt: tokens.access_expires_at
		};
		this.persist();
	}

	updatePrincipal(principal: Principal) {
		if (!this.session) return;
		this.session = { ...this.session, principal };
		this.persist();
	}

	clear() {
		this.session = null;
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(STORAGE_KEY);
		}
	}

	loadFromStorage() {
		if (typeof localStorage === 'undefined') return;
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		try {
			this.session = JSON.parse(raw) as AuthSession;
		} catch {
			localStorage.removeItem(STORAGE_KEY);
		}
	}

	private persist() {
		if (typeof localStorage === 'undefined' || !this.session) return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
	}
}

export const auth = new AuthStore();
