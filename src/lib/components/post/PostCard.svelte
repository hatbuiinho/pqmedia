<script lang="ts">
	import { untrack } from 'svelte';
	import Icon from '@iconify/svelte';
	import type { Post, PostPublication, ReactionSummary } from '$contracts/backend';
	import { auth } from '$lib/stores/auth.svelte';
	import { formatRelativeVi } from '$lib/utils/time';
	import CommentList from './CommentList.svelte';
	import PostMedia from './PostMedia.svelte';
	import PublicationBadges from './PublicationBadges.svelte';
	import ReactionControl from './ReactionControl.svelte';

	interface Props {
		post: Post;
		/** When true the inline comment list is expanded on mount (used on post detail page). */
		startWithCommentsOpen?: boolean;
		onDelete?: (id: string) => void;
		onReactionsChange?: (postID: string, summaries: ReactionSummary[]) => void;
		onPublicationsChange?: (postID: string, publications: PostPublication[]) => void;
		onCommentCountChange?: (postID: string, count: number) => void;
	}

	let {
		post,
		startWithCommentsOpen = false,
		onDelete,
		onReactionsChange,
		onPublicationsChange,
		onCommentCountChange
	}: Props = $props();

	const isMine = $derived(auth.principal?.user.id === post.author.id);
	const canDelete = $derived(isMine || (auth.principal?.user.is_admin ?? false));

	// `untrack` keeps Svelte from warning about reading a reactive prop at $state
	// init: we deliberately want the initial value only — subsequent toggles are local.
	let commentsOpen = $state(untrack(() => startWithCommentsOpen));

	const commentLabel = $derived(
		post.comment_count === 0 ? 'Bình luận' : `${post.comment_count} bình luận`
	);
</script>

<article class="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
	<header class="flex items-center gap-3">
		{#if post.author.avatar_url}
			<img
				src={post.author.avatar_url}
				alt=""
				class="h-9 w-9 rounded-full object-cover"
				loading="lazy"
			/>
		{:else}
			<div
				class="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600"
			>
				{post.author.full_name.slice(0, 1).toUpperCase()}
			</div>
		{/if}
		<div class="flex-1">
			<div class="text-sm font-semibold text-slate-900">{post.author.full_name}</div>
			<div class="text-xs text-slate-500">{formatRelativeVi(post.created_at)}</div>
		</div>
		{#if canDelete && onDelete}
			<button
				type="button"
				class="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
				onclick={() => onDelete?.(post.id)}
				aria-label="Xoá bài"
			>
				Xoá
			</button>
		{/if}
	</header>

	{#if post.content}
		<p class="whitespace-pre-wrap text-sm text-slate-800">{post.content}</p>
	{/if}

	<PostMedia attachments={post.attachments} />

	<ReactionControl
		targetType="post"
		targetID={post.id}
		summaries={post.reactions}
		onChange={(s) => onReactionsChange?.(post.id, s)}
	/>

	{#if isMine}
		<div class="border-t border-slate-100 pt-3">
			<div class="mb-1 text-xs text-slate-500">Đã đăng ở:</div>
			<PublicationBadges
				postID={post.id}
				publications={post.publications}
				onChange={(pubs) => onPublicationsChange?.(post.id, pubs)}
			/>
		</div>
	{:else if post.publications.length > 0}
		<div class="flex flex-wrap gap-1 border-t border-slate-100 pt-3 text-xs">
			{#each post.publications as pub (pub.id)}
				<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">{pub.platform}</span>
			{/each}
		</div>
	{/if}

	<footer class="border-t border-slate-100 pt-3">
		<button
			type="button"
			onclick={() => (commentsOpen = !commentsOpen)}
			aria-expanded={commentsOpen}
			class="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
		>
			<Icon icon="lucide:message-square" class="text-base" />
			<span>{commentLabel}</span>
			<Icon icon={commentsOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'} class="text-base" />
		</button>
	</footer>

	{#if commentsOpen}
		<div class="border-t border-slate-100 pt-3">
			<CommentList
				postID={post.id}
				showHeading={false}
				onCountChange={(count) => onCommentCountChange?.(post.id, count)}
			/>
		</div>
	{/if}
</article>
