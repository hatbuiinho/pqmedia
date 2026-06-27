<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Post, PostPublication, ReactionSummary } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { deletePost, getPost } from '$lib/api/posts';
	import PostCard from '$lib/components/post/PostCard.svelte';

	let post = $state<Post | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const postID = $derived(page.params.postID ?? '');

	// Track postID only; everything load() touches must stay untracked or the
	// effect would loop when load() writes back to `post`/`loading`/`error`.
	$effect(() => {
		const id = postID;
		if (id) untrack(() => void load());
	});

	async function load() {
		loading = true;
		error = null;
		try {
			post = await getPost(postID);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Không tải được bài';
		} finally {
			loading = false;
		}
	}

	async function onDelete(id: string) {
		if (!confirm('Xoá bài này?')) return;
		try {
			await deletePost(id);
			await goto(resolve('/feed'));
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Xoá thất bại';
		}
	}

	function onReactionsChange(_id: string, summaries: ReactionSummary[]) {
		if (post) post = { ...post, reactions: summaries };
	}

	function onPublicationsChange(_id: string, publications: PostPublication[]) {
		if (post) post = { ...post, publications };
	}

	function onCommentCountChange(_id: string, count: number) {
		if (post) post = { ...post, comment_count: count };
	}

	function onPostUpdated(updated: Post) {
		post = updated;
	}
</script>

<section class="space-y-4">
	<a href={resolve('/feed')} class="text-sm text-slate-500 hover:text-slate-700">← Quay lại</a>

	{#if loading}
		<p class="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">Đang tải…</p>
	{:else if error}
		<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
	{:else if post}
		<PostCard
			{post}
			startWithCommentsOpen={true}
			onDelete={(id) => onDelete(id)}
			{onReactionsChange}
			{onPublicationsChange}
			{onCommentCountChange}
			{onPostUpdated}
		/>
	{/if}
</section>
