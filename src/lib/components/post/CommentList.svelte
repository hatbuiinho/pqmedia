<script lang="ts">
	import { untrack } from 'svelte';
	import type { PostComment, ReactionSummary } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { createComment, deleteComment, listComments } from '$lib/api/comments';
	import { auth } from '$lib/stores/auth.svelte';
	import { formatRelativeVi } from '$lib/utils/time';
	import ReactionControl from './ReactionControl.svelte';

	interface Props {
		postID: string;
		/** Hide the "Bình luận" heading when embedded inside a PostCard. */
		showHeading?: boolean;
		/** Bubble the latest comment count up so callers can refresh post.comment_count. */
		onCountChange?: (count: number) => void;
	}

	let { postID, showHeading = true, onCountChange }: Props = $props();

	let comments = $state<PostComment[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let draft = $state('');
	let posting = $state(false);

	// Plain (non-reactive) guard: `load()` cascades to onCountChange → parent
	// updates `post` → new prop reference back into this component. Without the
	// guard the effect would refire each time and re-hit the comments endpoint.
	let loadedFor: string | null = null;

	$effect(() => {
		const id = postID;
		if (!id || id === loadedFor) return;
		loadedFor = id;
		untrack(() => void load());
	});

	async function load() {
		loading = true;
		error = null;
		try {
			const data = await listComments(postID);
			comments = data.items;
			onCountChange?.(comments.length);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Không tải được bình luận';
		} finally {
			loading = false;
		}
	}

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		const text = draft.trim();
		if (!text || posting) return;
		posting = true;
		try {
			const created = await createComment(postID, text);
			comments = [...comments, created];
			draft = '';
			onCountChange?.(comments.length);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Không gửi được bình luận';
		} finally {
			posting = false;
		}
	}

	async function onDelete(id: string) {
		if (!confirm('Xoá bình luận?')) return;
		try {
			await deleteComment(id);
			comments = comments.filter((c) => c.id !== id);
			onCountChange?.(comments.length);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Xoá thất bại';
		}
	}

	function patchReactions(commentID: string, summaries: ReactionSummary[]) {
		comments = comments.map((c) => (c.id === commentID ? { ...c, reactions: summaries } : c));
	}

	function canDelete(c: PostComment) {
		return c.author.id === auth.principal?.user.id || (auth.principal?.user.is_admin ?? false);
	}
</script>

<section class="space-y-3">
	{#if showHeading}
		<h2 class="text-sm font-semibold text-slate-700">Bình luận</h2>
	{/if}

	{#if loading}
		<p class="text-sm text-slate-500">Đang tải…</p>
	{:else if error}
		<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
	{/if}

	{#if comments.length > 0}
		<ul class="space-y-3">
			{#each comments as c (c.id)}
				<li class="w-full">
					<div class="w-full max-w-full pb-4 sm:max-w-xl lg:max-w-2xl">
						<div
							class="relative rounded-2xl border border-slate-200/80 bg-slate-100/80 px-4 py-3 shadow-sm"
						>
							<div class="flex items-baseline gap-2 text-sm">
								<span class="font-medium text-slate-900">{c.author.full_name}</span>
								<span class="text-xs text-slate-500">{formatRelativeVi(c.created_at)}</span>
								{#if canDelete(c)}
									<button
										type="button"
										class="ml-auto text-xs text-slate-400 transition hover:text-rose-600"
										onclick={() => onDelete(c.id)}
									>
										Xoá
									</button>
								{/if}
							</div>
							<p
								class="mt-1 whitespace-pre-wrap break-words pr-10 text-sm leading-5 text-slate-800"
							>
								{c.content}
							</p>
							<ReactionControl
								targetType="comment"
								targetID={c.id}
								summaries={c.reactions}
								variant="comment-float"
								onChange={(s) => patchReactions(c.id, s)}
							/>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	<form class="flex items-end gap-2" onsubmit={onSubmit}>
		<textarea
			bind:value={draft}
			placeholder="Viết bình luận…"
			rows="1"
			class="flex-1 resize-none rounded-lg border-slate-300 text-sm focus:border-slate-500 focus:ring-slate-500"
		></textarea>
		<button
			type="submit"
			disabled={posting || draft.trim() === ''}
			class="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
		>
			{posting ? '…' : 'Gửi'}
		</button>
	</form>
</section>
