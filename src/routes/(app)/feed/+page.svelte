<script lang="ts">
	import { flip } from 'svelte/animate';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
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
	import HashtagSidebar from '$lib/components/feed/HashtagSidebar.svelte';
	import PendingPostCard from '$lib/components/post/PendingPostCard.svelte';
	import PostCard from '$lib/components/post/PostCard.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { feedHashtagSidebar } from '$lib/stores/feedHashtagSidebar.svelte';
	import { hashtags } from '$lib/stores/hashtags.svelte';
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
	let appliedSearchQuery = $state('');
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
		}
		if (q !== appliedSearchQuery) {
			appliedSearchQuery = q;
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
		appliedSearchQuery = searchQuery;
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
			feedHashtagSidebar.hide();
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
			void hashtags.refresh();
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
		const normalizedQuery = query.trim();
		if (normalizedQuery === appliedSearchQuery) return;
		const url = new URL($page.url);
		if (normalizedQuery) {
			url.searchParams.set('q', normalizedQuery);
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

	function applyHashtagFilter(name: string) {
		const url = new URL($page.url);
		url.searchParams.set('hashtag', name);
		void goto(resolve(`/(app)/feed?${url.searchParams.toString()}`), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}

	function closeHashtagDrawer() {
		feedHashtagSidebar.hide();
	}

	function onDrawerKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		closeHashtagDrawer();
	}
</script>

<section class="space-y-4 lg:space-y-0 lg:pl-[calc(17rem+1.5rem)]">
	<aside class="relative hidden lg:block" aria-hidden="true">
		<div
			class="fixed top-[4.75rem] left-[max(1rem,calc((100vw-88rem)/2+1rem))] z-20 h-[calc(100dvh-5.75rem)] w-[17rem]"
		>
			<HashtagSidebar
				activeHashtag={currentHashtag}
				onSelect={applyHashtagFilter}
				onClear={removeHashtagFilter}
				{loading}
			/>
		</div>
	</aside>

	<div class="mx-auto min-w-0 max-w-[42rem] space-y-4">
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

			{#if currentHashtag}
				<div class="flex items-center gap-2 lg:hidden">
					<button
						type="button"
						onclick={removeHashtagFilter}
						class="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--app-primary-soft)] px-3 py-1.5 text-sm font-medium text-[var(--app-primary-strong)] transition hover:opacity-90"
						aria-label={`Đang lọc theo hashtag ${currentHashtag}. Bấm để bỏ lọc`}
					>
						<span class="truncate">#{currentHashtag}</span>
						<span class="icon-[lucide--x] size-4 shrink-0" aria-hidden="true"></span>
					</button>
					{#if loading}
						<span
							class="icon-[lucide--loader-circle] size-4 animate-spin text-slate-400"
							aria-label="Đang tải bài viết theo hashtag"
						></span>
					{/if}
				</div>
			{:else if loading && feedEntries.length > 0}
				<div class="flex items-center gap-2 text-xs text-slate-500">
					<span
						class="icon-[lucide--loader-circle] size-4 animate-spin text-slate-400"
						aria-hidden="true"
					></span>
					<span>Đang cập nhật bảng tin…</span>
				</div>
			{/if}

			<FeedFilter {unpublishedOn} onChange={applyUnpublishedFilter} compact />
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

		{#if loading && feedEntries.length === 0}
			<div class="rounded-2xl bg-white p-6 shadow-sm">
				<div class="flex items-center justify-center gap-3 text-sm text-slate-500">
					<span
						class="icon-[lucide--loader-circle] size-5 animate-spin text-slate-400"
						aria-hidden="true"
					></span>
					<span>Đang tải bảng tin…</span>
				</div>
			</div>
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
			<div class="grid justify-items-center gap-2 pt-1 pb-1">
				<p class="text-[0.82rem] text-slate-500">Đang hiển thị {posts.length} / {total} bài viết</p>
				<button
					type="button"
					disabled={loading}
					class="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition active:translate-y-px disabled:opacity-60"
					onclick={() => loadMore()}
				>
					{#if loading}
						<span
							class="icon-[lucide--loader-circle] size-4 animate-spin text-slate-400"
							aria-hidden="true"
						></span>
					{/if}
					Xem thêm bài cũ
				</button>
			</div>
		{:else if posts.length > 0}
			<p class="pb-1 text-center text-[0.82rem] text-slate-500">
				Đang hiển thị {posts.length} / {total} bài viết
			</p>
		{/if}
	</div>
</section>

{#if feedHashtagSidebar.open}
	<div
		class="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm lg:hidden"
		role="presentation"
		transition:fade={{ duration: 180 }}
		onclick={closeHashtagDrawer}
		onkeydown={onDrawerKeydown}
	></div>

	<div
		class="fixed inset-y-0 left-0 z-50 flex w-[min(22rem,calc(100vw-2.5rem))] max-w-full flex-col border-r border-slate-200 bg-slate-50 shadow-2xl lg:hidden"
		role="dialog"
		aria-modal="true"
		aria-label="Hashtag"
		tabindex="-1"
		transition:fly={{ x: -288, duration: 220 }}
		onclick={(event) => event.stopPropagation()}
		onkeydown={onDrawerKeydown}
	>
		<div class="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
			<h2 class="text-base font-semibold text-slate-900">Hashtag</h2>
			<button
				type="button"
				onclick={closeHashtagDrawer}
				class="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
				aria-label="Đóng"
			>
				<span class="icon-[lucide--x] size-5" aria-hidden="true"></span>
			</button>
		</div>
		<div class="min-h-0 flex-1 overflow-y-auto pb-4">
			<HashtagSidebar
				activeHashtag={currentHashtag}
				onSelect={applyHashtagFilter}
				onClear={removeHashtagFilter}
				{loading}
				mobile
				onRequestClose={closeHashtagDrawer}
			/>
		</div>
	</div>
{/if}

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
