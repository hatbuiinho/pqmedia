<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';

	$effect(() => {
		void goto(resolve(auth.isAuthenticated ? '/feed' : '/login'), { replaceState: true });
	});
</script>

<p class="p-6 text-slate-500">Đang chuyển hướng…</p>
