<script lang="ts">
	import type { Post } from '$contracts/backend';
	import { formatRelativeVi } from '$lib/utils/time';
	import PostContentPreview from './PostContentPreview.svelte';
	import PostMedia from './PostMedia.svelte';

	interface Props {
		post: Post;
		status: 'waiting_uploads' | 'publishing' | 'failed';
		error?: string | null;
	}

	let { post, status, error = null }: Props = $props();

	const statusTone = $derived(
		status === 'failed'
			? 'bg-rose-50 text-rose-700'
			: status === 'publishing'
				? 'bg-emerald-50 text-emerald-700'
				: 'bg-amber-50 text-amber-700'
	);

	const statusLabel = $derived(
		status === 'failed' ? 'Đăng thất bại' : status === 'publishing' ? 'Đang đăng' : 'Đang tải lên'
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
		<div class="min-w-0 flex-1">
			<div class="text-sm font-semibold text-slate-900">{post.author.full_name}</div>
			<div class="text-xs text-slate-500">{formatRelativeVi(post.created_at)}</div>
		</div>
		<span class={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone}`}>
			{statusLabel}
		</span>
	</header>

	{#if post.content}
		<PostContentPreview content={post.content} />
	{/if}

	{#if post.hashtags.length > 0}
		<div class="flex flex-wrap gap-1">
			{#each post.hashtags as tag (tag)}
				<span class="text-sm font-medium text-indigo-600">#{tag}</span>
			{/each}
		</div>
	{/if}

	<PostMedia attachments={post.attachments} />

	{#if error}
		<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
	{/if}
</article>
