<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PostComposer from '$lib/components/post/PostComposer.svelte';

	async function onSubmitted() {
		await goto(resolve('/feed'));
	}
</script>

<section class="space-y-4">
	<h1 class="text-xl font-semibold">Đăng bài mới</h1>
	<PostComposer onSubmitted={() => onSubmitted()} />
</section>
