<script lang="ts">
	import { flip } from 'svelte/animate';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type {
		Post,
		PostPublication,
		PublicationPlatform,
		ReactionSummary
	} from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { deletePost, listFeed } from '$lib/api/posts';
	import FeedFilter from '$lib/components/feed/FeedFilter.svelte';
	import PendingPostCard from '$lib/components/post/PendingPostCard.svelte';
	import PostCard from '$lib/components/post/PostCard.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { postComposer } from '$lib/stores/postComposer.svelte';
	import { platforms } from '$lib/stores/platforms.svelte';

	const PAGE_SIZE = 20;
	const HEAD_POLL_LIMIT = 5;
	const HEAD_POLL_MS = 45_000;
	const HEAD_POLL_MAX_MS = 5 * 60_000;
	const AUTO_INSERT_TOP_THRESHOLD = 220;

	let posts = $state<Post[]>([]);
	let total = $state(0);
	let offset = $state(0);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let deleteTargetID = $state<string | null>(null);
	let deleting = $state(false);
	let pendingHeadPosts = $state<Post[]>([]);
	let pendingHeadTotal = $state<number | null>(null);
	let headPolling = $state(false);
	let isDocumentVisible = $state(true);
	let isOnline = $state(true);
	let pollFailureCount = $state(0);
	let highlightedEntryKeys = $state<string[]>([]);
	let highlightTimer: ReturnType<typeof setTimeout> | null = null;

	const hasMore = $derived(posts.length < total);
	const feedEntries = $derived.by(() => {
		const seen: string[] = [];
		const merged: Array<
			| {
					key: string;
					kind: 'pending';
					status: 'waiting_uploads' | 'publishing' | 'failed';
					error: string | null;
					post: Post;
			  }
			| { key: string; kind: 'post'; post: Post }
		> = [];

		for (const entry of postComposer.feedEntries) {
			if (entry.status === 'published') {
				if (seen.includes(entry.post.id)) continue;
				seen.push(entry.post.id);
				merged.push({ key: entry.key, kind: 'post', post: entry.post });
				continue;
			}
			seen.push(entry.key);
			merged.push({
				key: entry.key,
				kind: 'pending',
				post: entry.post,
				status: entry.status,
				error: entry.error
			});
		}

		for (const post of posts) {
			if (seen.includes(post.id)) continue;
			seen.push(post.id);
			merged.push({ key: post.id, kind: 'post', post });
		}
		return merged;
	});

	let searchQuery = $state('');
	let currentHashtag = $state('');
	let unpublishedOn = $state<PublicationPlatform[]>([]);
	let searchTimeout: ReturnType<typeof setTimeout>;
	let headPollTimer: ReturnType<typeof setTimeout> | null = null;

	function idsOf(items: Post[]): string[] {
		return items.map((item) => item.id);
	}

	function mergeUniquePosts(incoming: Post[], existing: Post[]): Post[] {
		const seen = idsOf(existing);
		const next = [...existing];
		for (const item of incoming) {
			if (seen.includes(item.id)) continue;
			seen.push(item.id);
			next.push(item);
		}
		return next;
	}

	function prependUniquePosts(incoming: Post[], existing: Post[]): Post[] {
		const seen = idsOf(incoming);
		const tail = existing.filter((item) => !seen.includes(item.id));
		return [...incoming, ...tail];
	}

	function clearPendingHeadPosts() {
		pendingHeadPosts = [];
		pendingHeadTotal = null;
	}

	function setHighlightedKeys(keys: string[]) {
		if (keys.length === 0) return;
		highlightedEntryKeys = [...highlightedEntryKeys.filter((key) => !keys.includes(key)), ...keys];
		if (highlightTimer) clearTimeout(highlightTimer);
		highlightTimer = setTimeout(() => {
			highlightedEntryKeys = highlightedEntryKeys.filter((key) => !keys.includes(key));
			highlightTimer = null;
		}, 900);
	}

	function applyIncomingPosts(incoming: Post[], nextTotal?: number | null) {
		if (incoming.length === 0) return;
		posts = prependUniquePosts(incoming, posts);
		offset += incoming.length;
		setHighlightedKeys(idsOf(incoming));
		if (typeof nextTotal === 'number') {
			total = Math.max(total + incoming.length, nextTotal);
		} else {
			total += incoming.length;
		}
	}

	function applyPendingHeadPosts() {
		if (pendingHeadPosts.length === 0) return;
		applyIncomingPosts(pendingHeadPosts, pendingHeadTotal);
		clearPendingHeadPosts();
	}

	function isNearTop(): boolean {
		if (typeof window === 'undefined') return false;
		return window.scrollY <= AUTO_INSERT_TOP_THRESHOLD;
	}

	function shouldPollHead(): boolean {
		return isDocumentVisible && isOnline && !loading && !headPolling && posts.length > 0;
	}

	function nextHeadPollDelay(): number {
		return Math.min(HEAD_POLL_MS * 2 ** pollFailureCount, HEAD_POLL_MAX_MS);
	}

	function clearHeadPollTimer() {
		if (!headPollTimer) return;
		clearTimeout(headPollTimer);
		headPollTimer = null;
	}

	function scheduleHeadPoll(delay = nextHeadPollDelay()) {
		clearHeadPollTimer();
		if (typeof window === 'undefined') return;
		headPollTimer = setTimeout(() => {
			void pollHead();
		}, delay);
	}

	function parseUnpublishedOn(raw: string | null): PublicationPlatform[] {
		return platforms.parseActiveKeys(raw) as PublicationPlatform[];
	}

	$effect(() => {
		const q = $page.url.searchParams.get('q') || '';
		const h = $page.url.searchParams.get('hashtag') || '';
		const up = parseUnpublishedOn($page.url.searchParams.get('unpublished_on'));
		// Only update local input if URL changes externally (e.g., initial load or back button)
		if (h !== currentHashtag) {
			currentHashtag = h;
			void loadInitial();
		}
		if (q !== searchQuery && document.activeElement?.getAttribute('name') !== 'search') {
			searchQuery = q;
			void loadInitial();
		}
		if (up.join(',') !== unpublishedOn.join(',')) {
			unpublishedOn = up;
			void loadInitial();
		}
	});

	onMount(() => {
		isDocumentVisible =
			typeof document === 'undefined' ? true : document.visibilityState === 'visible';
		isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
		searchQuery = $page.url.searchParams.get('q') || '';
		currentHashtag = $page.url.searchParams.get('hashtag') || '';
		unpublishedOn = parseUnpublishedOn($page.url.searchParams.get('unpublished_on'));
		void loadInitial();

		const onVisibilityChange = () => {
			isDocumentVisible = document.visibilityState === 'visible';
			if (isDocumentVisible) {
				void pollHead();
			} else {
				clearHeadPollTimer();
			}
		};
		const onOnline = () => {
			isOnline = true;
			void pollHead();
		};
		const onOffline = () => {
			isOnline = false;
			clearHeadPollTimer();
		};

		document.addEventListener('visibilitychange', onVisibilityChange);
		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);

		return () => {
			clearTimeout(searchTimeout);
			clearHeadPollTimer();
			if (highlightTimer) clearTimeout(highlightTimer);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
		};
	});

	async function loadInitial() {
		clearPendingHeadPosts();
		pollFailureCount = 0;
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
				hashtag: currentHashtag || undefined,
				unpublished_on: unpublishedOn.length > 0 ? unpublishedOn.join(',') : undefined
			});
			posts = offset === 0 ? data.items : [...posts, ...data.items];
			total = data.page.total;
			offset += data.items.length;
			if (offset === data.items.length) {
				clearPendingHeadPosts();
			}
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Tải bảng tin thất bại';
		} finally {
			loading = false;
			scheduleHeadPoll();
		}
	}

	async function pollHead() {
		if (!shouldPollHead()) {
			if (isDocumentVisible && isOnline) scheduleHeadPoll();
			return;
		}

		headPolling = true;
		try {
			const data = await listFeed({
				limit: HEAD_POLL_LIMIT,
				offset: 0,
				q: searchQuery || undefined,
				hashtag: currentHashtag || undefined,
				unpublished_on: unpublishedOn.length > 0 ? unpublishedOn.join(',') : undefined
			});

			const headID = posts[0]?.id;
			if (!headID) {
				pollFailureCount = 0;
				scheduleHeadPoll();
				return;
			}

			const knownIDs = [
				...idsOf(posts),
				...idsOf(pendingHeadPosts),
				...postComposer.feedEntries.map((entry) => entry.post.id)
			];
			const existingIndex = data.items.findIndex((item) => item.id === headID);
			const incomingSlice =
				existingIndex > 0
					? data.items.slice(0, existingIndex)
					: existingIndex === -1
						? data.items
						: [];
			const incoming = incomingSlice.filter((item) => !knownIDs.includes(item.id));

			if (incoming.length > 0) {
				if (isNearTop()) {
					applyIncomingPosts(incoming, data.page.total);
				} else {
					pendingHeadPosts = mergeUniquePosts(incoming, pendingHeadPosts);
					pendingHeadTotal = data.page.total;
				}
			}

			pollFailureCount = 0;
		} catch {
			pollFailureCount += 1;
		} finally {
			headPolling = false;
			if (isDocumentVisible && isOnline) {
				scheduleHeadPoll();
			}
		}
	}

	function requestDelete(id: string) {
		if (deleting) return;
		deleteTargetID = id;
	}

	function cancelDelete() {
		if (deleting) return;
		deleteTargetID = null;
	}

	async function confirmDelete() {
		if (!deleteTargetID || deleting) return;
		const id = deleteTargetID;
		deleting = true;
		try {
			await deletePost(id);
			posts = posts.filter((p) => p.id !== id);
			pendingHeadPosts = pendingHeadPosts.filter((p) => p.id !== id);
			total = Math.max(0, total - 1);
			postComposer.removeFeedEntry(id);
			deleteTargetID = null;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Xoá thất bại';
		} finally {
			deleting = false;
		}
	}

	function onReactionsChange(postID: string, summaries: ReactionSummary[]) {
		posts = posts.map((p) => (p.id === postID ? { ...p, reactions: summaries } : p));
		postComposer.updateFeedPost(postID, (post) => ({ ...post, reactions: summaries }));
	}

	function onPublicationsChange(postID: string, publications: PostPublication[]) {
		posts = posts.map((p) => (p.id === postID ? { ...p, publications } : p));
		postComposer.updateFeedPost(postID, (post) => ({ ...post, publications }));
	}

	function onCommentCountChange(postID: string, count: number) {
		posts = posts.map((p) => (p.id === postID ? { ...p, comment_count: count } : p));
		postComposer.updateFeedPost(postID, (post) => ({ ...post, comment_count: count }));
	}

	function onPostUpdated(updated: Post) {
		posts = posts.map((p) => (p.id === updated.id ? updated : p));
		postComposer.updateFeedPost(updated.id, () => updated);
	}

	function executeSearch(query: string) {
		const url = new URL($page.url);
		if (query) {
			url.searchParams.set('q', query);
		} else {
			url.searchParams.delete('q');
		}
		void goto(resolve(`/(app)/feed?${url.searchParams.toString()}`), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
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
		void goto(resolve(`/(app)/feed?${url.searchParams.toString()}`), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}

	function applyUnpublishedFilter(next: PublicationPlatform[]) {
		const url = new URL($page.url);
		if (next.length > 0) {
			url.searchParams.set('unpublished_on', next.join(','));
		} else {
			url.searchParams.delete('unpublished_on');
		}
		void goto(resolve(`/(app)/feed?${url.searchParams.toString()}`), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}
</script>

<section class="space-y-4">
	<header>
		<h1 class="text-xl font-semibold">Bảng tin</h1>
	</header>

	<div
		class="sticky top-[3.75rem] z-10 -mx-4 space-y-1.5 bg-slate-50/90 px-4 pt-1 pb-1.5 backdrop-blur-md"
	>
		<form class="relative w-full" onsubmit={handleSearch}>
			<input
				name="search"
				type="text"
				bind:value={searchQuery}
				oninput={onSearchInput}
				placeholder="Tìm kiếm bài viết..."
				class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-12 text-sm focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100"
			/>
			<button
				type="submit"
				class="absolute top-1/2 right-4 grid -translate-y-1/2 place-items-center text-slate-400 hover:text-slate-600"
				aria-label="Tìm kiếm"
			>
				<span class="icon-[lucide--search] size-5"></span>
			</button>
		</form>

		<FeedFilter {unpublishedOn} onChange={applyUnpublishedFilter} compact />

		{#if currentHashtag}
			<div
				class="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-900"
			>
				<span class="icon-[lucide--hash] size-4 shrink-0"></span>
				<span class="min-w-0 truncate">Đang lọc theo: <strong>{currentHashtag}</strong></span>
				<button
					type="button"
					class="ml-auto shrink-0 text-indigo-500 hover:text-indigo-700"
					onclick={removeHashtagFilter}
					aria-label="Xóa bộ lọc"
				>
					Bỏ lọc
				</button>
			</div>
		{/if}
	</div>

	{#if pendingHeadPosts.length > 0}
		<div class="sticky top-[8.75rem] z-10 -mx-4 px-4">
			<button
				type="button"
				class="mx-auto flex w-full max-w-sm items-center justify-center gap-2 rounded-full border border-[var(--app-border-strong)] bg-white/95 px-4 py-2 text-sm font-medium text-[var(--app-primary-strong)] shadow-sm backdrop-blur"
				onclick={applyPendingHeadPosts}
			>
				<span class="icon-[lucide--arrow-up] size-4" aria-hidden="true"></span>
				<span>
					Có {pendingHeadPosts.length} bài viết mới
				</span>
				<span class="text-xs text-slate-500">Xem</span>
			</button>
		</div>
	{/if}

	{#if error}
		<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
	{/if}

	{#if feedEntries.length === 0 && !loading}
		<p class="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
			Chưa có bài viết nào.
		</p>
	{/if}

	<div class="space-y-3">
		{#each feedEntries as entry (entry.key)}
			<div
				animate:flip={{ duration: 220, easing: (t) => t }}
				in:fly={{
					y: highlightedEntryKeys.includes(entry.key) ? -20 : 0,
					opacity: highlightedEntryKeys.includes(entry.key) ? 0.55 : 1,
					duration: highlightedEntryKeys.includes(entry.key) ? 240 : 0
				}}
				class={highlightedEntryKeys.includes(entry.key)
					? 'origin-top transition duration-700 ease-out'
					: ''}
			>
				{#if entry.kind === 'pending'}
					<PendingPostCard post={entry.post} status={entry.status} error={entry.error} />
				{:else}
					<PostCard
						post={entry.post}
						onDelete={(id) => requestDelete(id)}
						{onReactionsChange}
						{onPublicationsChange}
						{onCommentCountChange}
						{onPostUpdated}
					/>
				{/if}
			</div>
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

<ConfirmDialog
	open={deleteTargetID !== null}
	title="Xoá bài viết?"
	message="Bài viết và các bình luận liên quan sẽ bị xoá khỏi bảng tin."
	confirmText="Xoá bài"
	danger
	busy={deleting}
	onConfirm={confirmDelete}
	onCancel={cancelDelete}
/>
