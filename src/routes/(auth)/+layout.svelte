<script lang="ts">
	let { children } = $props();
</script>

<main class="grid min-h-dvh place-items-center bg-slate-50 px-4">
	<div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
		{@render children()}
	</div>
</main>
