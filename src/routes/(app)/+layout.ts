import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { auth } from '$lib/stores/auth.svelte';
import type { LayoutLoad } from './$types';

// Only guard. Principal refresh happens in +layout.svelte via onMount so:
//  - we don't call window.fetch inside load() (SvelteKit warning)
//  - the load() function doesn't read+mutate $state in a way that triggers re-runs
export const load: LayoutLoad = () => {
	if (!browser) return;
	if (!auth.isAuthenticated) {
		throw redirect(307, '/login');
	}
};
