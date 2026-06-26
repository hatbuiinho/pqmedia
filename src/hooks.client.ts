import { auth } from '$lib/stores/auth.svelte';

// Restore auth session from localStorage on initial app boot.
// Must run before any +layout.ts load() so guards see the correct state.
auth.loadFromStorage();
