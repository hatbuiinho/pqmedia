<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { Post, PostPublication, ReactionSummary } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { deletePost, listFeed } from '$lib/api/posts';
	import PostCard from '$lib/components/post/PostCard.svelte';
	import PostComposer from '$lib/components/post/PostComposer.svelte';

	const PAGE_SIZE = 20;

	let posts = $state<Post[]>([]);
	let total = $state(0);
	let offset = $state(0);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const hasMore = $derived(posts.length < total);

	// onMount runs once outside Svelte's reactive system, so the async writes
	// to `loading`/`offset`/`posts` (and the auth state apiFetch touches) don't
	// re-trigger the loader. $effect would track those reads and loop.
	onMount(() => {
		void loadInitial();
	});

	async function loadInitial() {
		offset = 0;
		posts = [];
		await loadMore();
	}

	async function loadMore() {
		if (loading) return;
		loading = true;
		error = null;
		try {
			const data = await listFeed({ limit: PAGE_SIZE, offset });
			posts = offset === 0 ? data.items : [...posts, ...data.items];
			total = data.page.total;
			offset += data.items.length;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Tải bảng tin thất bại';
		} finally {
			loading = false;
		}
	}

	async function onPostCreated() {
		await loadInitial();
	}

	async function onDelete(id: string) {
		if (!confirm('Xoá bài này?')) return;
		try {
			await deletePost(id);
			posts = posts.filter((p) => p.id !== id);
			total = Math.max(0, total - 1);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Xoá thất bại';
		}
	}

	function onReactionsChange(postID: string, summaries: ReactionSummary[]) {
		posts = posts.map((p) => (p.id === postID ? { ...p, reactions: summaries } : p));
	}

	function onPublicationsChange(postID: string, publications: PostPublication[]) {
		posts = posts.map((p) => (p.id === postID ? { ...p, publications } : p));
	}

	function onCommentCountChange(postID: string, count: number) {
		posts = posts.map((p) => (p.id === postID ? { ...p, comment_count: count } : p));
	}
</script>

<section class="space-y-4">
	<header class="flex items-center justify-between">
		<h1 class="text-xl font-semibold">Bảng tin</h1>
		<a
			href={resolve('/posts/new')}
			class="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
		>
			Đăng bài
		</a>
	</header>

	<PostComposer onCreated={() => onPostCreated()} />

	{#if error}
		<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
	{/if}

	{#if posts.length === 0 && !loading}
		<p class="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
			Chưa có bài viết nào.
		</p>
	{/if}

	<div class="space-y-3">
		{#each posts as post (post.id)}
			<PostCard {post} onDelete={(id) => onDelete(id)} {onReactionsChange} {onPublicationsChange} />
		{/each}
	</div>

	{#if hasMore}
		<button
			type="button"
			disabled={loading}
			class="block w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
			onclick={() => loadMore()}
		>
			{loading ? 'Đang tải…' : 'Tải thêm'}
		</button>
	{/if}
</section>
