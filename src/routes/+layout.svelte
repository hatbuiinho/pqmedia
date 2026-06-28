<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { ensureServiceWorkerRegistration } from '$lib/push/web-push';
	import './layout.css';

	let { children } = $props();

	onMount(() => {
		if (!browser) return;
		void ensureServiceWorkerRegistration().catch((error) => {
			console.warn('[service-worker] registration failed', error);
		});
	});
</script>

{@render children()}
