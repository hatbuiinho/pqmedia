<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
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

	let searchQuery = $state('');
	let currentHashtag = $state('');
	let searchTimeout: ReturnType<typeof setTimeout>;

	$effect(() => {
		const q = $page.url.searchParams.get('q') || '';
		const h = $page.url.searchParams.get('hashtag') || '';
		// Only update local input if URL changes externally (e.g., initial load or back button)
		if (h !== currentHashtag) {
			currentHashtag = h;
			void loadInitial();
		}
		if (q !== searchQuery && document.activeElement?.getAttribute('name') !== 'search') {
			searchQuery = q;
			void loadInitial();
		}
	});

	onMount(() => {
		searchQuery = $page.url.searchParams.get('q') || '';
		currentHashtag = $page.url.searchParams.get('hashtag') || '';
		void loadInitial();
	});

	async function loadInitial() {
		offset = 0;
		// Do not clear posts here to avoid UI flash. They will be replaced when loadMore completes.
		await loadMore();
	}

	async function loadMore() {
		if (loading) return;
		loading = true;
		error = null;
		try {
			const data = await listFeed({
				limit: PAGE_SIZE,
				offset,
				q: searchQuery || undefined,
				hashtag: currentHashtag || undefined
			});
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

	function executeSearch(query: string) {
		const url = new URL($page.url);
		if (query) {
			url.searchParams.set('q', query);
		} else {
			url.searchParams.delete('q');
		}
		goto(resolve(`/(app)/feed${url.search}`), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		}).then(() => {
			void loadInitial();
		});
	}

	function handleSearch(e: Event) {
		e.preventDefault();
		clearTimeout(searchTimeout);
		executeSearch(searchQuery);
	}

	function onSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			executeSearch(searchQuery);
		}, 1000);
	}

	function removeHashtagFilter() {
		const url = new URL($page.url);
		url.searchParams.delete('hashtag');
		goto(resolve(`/(app)/feed${url.search}`));
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

	<form
		class="sticky top-[3.75rem] z-10 relative w-full pt-1 pb-2 bg-slate-50/90 backdrop-blur-md"
		onsubmit={handleSearch}
	>
		<input
			name="search"
			type="text"
			bind:value={searchQuery}
			oninput={onSearchInput}
			placeholder="Tìm kiếm bài viết..."
			class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100"
		/>
		<button
			type="submit"
			class="absolute top-1/2 right-4 grid -translate-y-1/2 place-items-center text-slate-400 hover:text-slate-600"
			aria-label="Tìm kiếm"
		>
			<span class="icon-[lucide--search] size-5"></span>
		</button>
	</form>

	{#if currentHashtag}
		<div class="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
			<span class="icon-[lucide--hash] size-4"></span>
			<span>Đang lọc theo: <strong>{currentHashtag}</strong></span>
			<button
				type="button"
				class="ml-auto text-indigo-500 hover:text-indigo-700"
				onclick={removeHashtagFilter}
				aria-label="Xóa bộ lọc"
			>
				Bỏ lọc
			</button>
		</div>
	{/if}

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
			<PostCard
				{post}
				onDelete={(id) => onDelete(id)}
				{onReactionsChange}
				{onPublicationsChange}
				{onCommentCountChange}
			/>
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
