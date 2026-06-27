<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type {
		AttachmentKind,
		Post,
		PostAttachment,
		PostAttachmentInput,
		PostPublication,
		ReactionSummary
	} from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { updatePost } from '$lib/api/posts';
	import { uploadFile } from '$lib/api/uploads';
	import { auth } from '$lib/stores/auth.svelte';
	import { formatRelativeVi } from '$lib/utils/time';
	import HashtagEditor from '$lib/components/form/HashtagEditor.svelte';
	import CommentList from './CommentList.svelte';
	import MediaPicker, { type PickerItem } from './MediaPicker.svelte';
	import PostActionsMenu from './PostActionsMenu.svelte';
	import PostMedia from './PostMedia.svelte';
	import PublicationConfirmDialog from './PublicationConfirmDialog.svelte';
	import PublicationManageSheet from './PublicationManageSheet.svelte';
	import PublicationStatus from './PublicationStatus.svelte';
	import ReactionControl from './ReactionControl.svelte';
	import ShareSheet from './ShareSheet.svelte';

	interface Props {
		post: Post;
		/** When true the inline comment list is expanded on mount (used on post detail page). */
		startWithCommentsOpen?: boolean;
		onDelete?: (id: string) => void;
		onReactionsChange?: (postID: string, summaries: ReactionSummary[]) => void;
		onPublicationsChange?: (postID: string, publications: PostPublication[]) => void;
		onCommentCountChange?: (postID: string, count: number) => void;
		onPostUpdated?: (post: Post) => void;
	}

	let {
		post,
		startWithCommentsOpen = false,
		onDelete,
		onReactionsChange,
		onPublicationsChange,
		onCommentCountChange,
		onPostUpdated
	}: Props = $props();

	const isMine = $derived(auth.principal?.user.id === post.author.id);
	const canEdit = $derived(isMine);
	const canDelete = $derived(isMine || (auth.principal?.user.is_admin ?? false));

	// `untrack` keeps Svelte from warning about reading a reactive prop at $state
	// init: we deliberately want the initial value only — subsequent toggles are local.
	let commentsOpen = $state(untrack(() => startWithCommentsOpen));

	const commentLabel = $derived(
		post.comment_count === 0 ? 'Bình luận' : `${post.comment_count} bình luận`
	);

	let shareOpen = $state(false);
	let confirmOpen = $state(false);
	let manageOpen = $state(false);

	// Inline edit state. Content + hashtags + attachments are editable.
	let isEditing = $state(false);
	let editDraft = $state('');
	let editSaving = $state(false);
	let editError = $state<string | null>(null);

	// Same extraction rule as PostComposer so edit/create stay in sync.
	const editHashtags = $derived.by(() => {
		const matches = editDraft.match(/(?:^|\s)(#[\p{L}\d_]+)/gu) || [];
		return Array.from(new Set(matches.map((m) => m.trim().slice(1))));
	});

	// Unified media list during edit: keeps existing attachments and pending uploads
	// in a single ordered array so reorder works across the boundary.
	interface ExistingEntry {
		kind: 'existing';
		id: string;
		mediaKind: AttachmentKind;
		attachment: PostAttachment;
	}
	interface PendingEntry {
		kind: 'pending';
		id: string;
		mediaKind: AttachmentKind;
		file: File;
		url: string;
	}
	type MediaEntry = ExistingEntry | PendingEntry;

	let editMedia = $state<MediaEntry[]>([]);
	let pendingCounter = 0;

	const editItems = $derived<PickerItem[]>(
		editMedia.map((e) =>
			e.kind === 'existing'
				? {
						id: e.id,
						kind: e.mediaKind,
						url: e.attachment.url,
						file_name: e.attachment.file_name,
						isPending: false
					}
				: {
						id: e.id,
						kind: e.mediaKind,
						url: e.url,
						file_name: e.file.name,
						isPending: true
					}
		)
	);

	function handleShared() {
		// Native share resolved → ask user which platforms they actually posted to.
		confirmOpen = true;
	}

	function handlePublicationsSaved(publications: PostPublication[]) {
		onPublicationsChange?.(post.id, publications);
	}

	function startEdit() {
		editDraft = post.content;
		editMedia = post.attachments.map<ExistingEntry>((a) => ({
			kind: 'existing',
			id: a.id,
			mediaKind: a.kind,
			attachment: a
		}));
		editError = null;
		isEditing = true;
	}

	function cancelEdit() {
		for (const e of editMedia) {
			if (e.kind === 'pending') URL.revokeObjectURL(e.url);
		}
		editMedia = [];
		isEditing = false;
		editError = null;
	}

	function addEditFiles(files: File[]) {
		const next: PendingEntry[] = files.map((file) => ({
			kind: 'pending',
			id: `pending-${++pendingCounter}`,
			mediaKind: file.type.startsWith('video/') ? 'video' : 'image',
			file,
			url: URL.createObjectURL(file)
		}));
		editMedia = [...editMedia, ...next];
	}

	function removeEditItem(id: string) {
		const entry = editMedia.find((e) => e.id === id);
		if (entry?.kind === 'pending') URL.revokeObjectURL(entry.url);
		editMedia = editMedia.filter((e) => e.id !== id);
	}

	function reorderEditItems(orderedIds: string[]) {
		const byId = new Map(editMedia.map((e) => [e.id, e]));
		editMedia = orderedIds.map((id) => byId.get(id)).filter((e): e is MediaEntry => !!e);
	}

	function attachmentsChanged(): boolean {
		const hasPending = editMedia.some((e) => e.kind === 'pending');
		if (hasPending) return true;
		if (editMedia.length !== post.attachments.length) return true;
		// Order matters — check both presence AND position.
		return editMedia.some((e, idx) => e.id !== post.attachments[idx]?.id);
	}

	function hashtagsChanged(): boolean {
		const current = post.hashtags ?? [];
		if (current.length !== editHashtags.length) return true;
		const sortedA = [...current].sort();
		const sortedB = [...editHashtags].sort();
		return sortedA.some((t, i) => t !== sortedB[i]);
	}

	async function buildAttachmentInputs(): Promise<PostAttachmentInput[]> {
		const out: PostAttachmentInput[] = [];
		for (const [sort_order, entry] of editMedia.entries()) {
			if (entry.kind === 'existing') {
				const a = entry.attachment;
				out.push({
					kind: a.kind,
					file_name: a.file_name,
					content_type: a.content_type,
					bucket: a.bucket,
					object_key: a.object_key,
					size_bytes: a.size_bytes,
					width: a.width,
					height: a.height,
					duration_ms: a.duration_ms,
					sort_order
				});
			} else {
				const uploaded = await uploadFile(entry.file, entry.mediaKind);
				out.push({
					kind: entry.mediaKind,
					file_name: uploaded.file_name,
					content_type: uploaded.content_type,
					bucket: uploaded.bucket,
					object_key: uploaded.object_key,
					size_bytes: uploaded.size_bytes,
					width: uploaded.width ?? null,
					height: uploaded.height ?? null,
					duration_ms: uploaded.duration_ms ?? null,
					sort_order
				});
			}
		}
		return out;
	}

	async function saveEdit() {
		if (editSaving) return;
		const nextContent = editDraft.trim();
		const contentChanged = nextContent !== post.content.trim();
		const mediaChanged = attachmentsChanged();
		const tagsChanged = hashtagsChanged();
		if (!contentChanged && !mediaChanged && !tagsChanged) {
			cancelEdit();
			return;
		}
		editSaving = true;
		editError = null;
		try {
			const body: {
				content?: string;
				attachments?: PostAttachmentInput[];
				hashtags?: string[];
			} = {};
			if (contentChanged) body.content = nextContent;
			if (tagsChanged) body.hashtags = editHashtags;
			if (mediaChanged) body.attachments = await buildAttachmentInputs();
			const updated = await updatePost(post.id, body);
			onPostUpdated?.(updated);
			for (const e of editMedia) {
				if (e.kind === 'pending') URL.revokeObjectURL(e.url);
			}
			editMedia = [];
			isEditing = false;
		} catch (err) {
			editError = err instanceof ApiError ? err.message : 'Lưu thất bại';
		} finally {
			editSaving = false;
		}
	}

	function confirmDelete() {
		if (!confirm('Xoá bài này?')) return;
		onDelete?.(post.id);
	}
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
		<PostActionsMenu
			canEdit={canEdit && !isEditing}
			canDelete={canDelete && !!onDelete && !isEditing}
			onEdit={startEdit}
			onDelete={confirmDelete}
		/>
	</header>

	{#if isEditing}
		<div class="space-y-3">
			<HashtagEditor
				bind:value={editDraft}
				placeholder="Sửa nội dung. Thêm hashtag bằng cách gõ #..."
			/>
			<MediaPicker
				items={editItems}
				disabled={editSaving}
				onAddFiles={addEditFiles}
				onRemove={removeEditItem}
				onReorder={reorderEditItems}
			/>
			{#if editError}
				<p class="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{editError}</p>
			{/if}
			<div class="flex items-center justify-end gap-2">
				<button
					type="button"
					onclick={cancelEdit}
					disabled={editSaving}
					class="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-60"
				>
					Huỷ
				</button>
				<button
					type="button"
					onclick={saveEdit}
					disabled={editSaving}
					class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
				>
					{editSaving ? 'Đang lưu…' : 'Lưu'}
				</button>
			</div>
		</div>
	{:else if post.content}
		<p class="whitespace-pre-wrap text-sm text-slate-800">{post.content}</p>
	{/if}

	{#if post.hashtags && post.hashtags.length > 0}
		<div class="flex flex-wrap gap-1">
			{#each post.hashtags as tag (tag)}
				<a
					href={resolve(`/(app)/feed?hashtag=${encodeURIComponent(tag)}`)}
					class="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
				>
					#{tag}
				</a>
			{/each}
		</div>
	{/if}

	{#if !isEditing}
		<PostMedia attachments={post.attachments} />
	{/if}

	<ReactionControl
		targetType="post"
		targetID={post.id}
		summaries={post.reactions}
		onChange={(s) => onReactionsChange?.(post.id, s)}
	/>

	{#if isMine}
		<div class="border-t border-slate-100 pt-3">
			<PublicationStatus
				publications={post.publications}
				onOpenManage={() => (manageOpen = true)}
			/>
		</div>
	{:else if post.publications.length > 0}
		<div class="border-t border-slate-100 pt-3">
			<PublicationStatus publications={post.publications} />
		</div>
	{/if}

	<footer class="flex items-center gap-4 border-t border-slate-100 pt-3">
		<button
			type="button"
			onclick={() => (commentsOpen = !commentsOpen)}
			aria-expanded={commentsOpen}
			class="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
		>
			<span class="icon-[lucide--message-square] text-base" aria-hidden="true"></span>
			<span>{commentLabel}</span>
			<span
				class={commentsOpen
					? 'icon-[lucide--chevron-up] text-base'
					: 'icon-[lucide--chevron-down] text-base'}
				aria-hidden="true"
			></span>
		</button>

		<button
			type="button"
			onclick={() => (shareOpen = true)}
			class="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
			aria-label="Chia sẻ bài viết"
		>
			<span class="icon-[lucide--share-2] text-base" aria-hidden="true"></span>
			<span>Chia sẻ</span>
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

<ShareSheet open={shareOpen} {post} onClose={() => (shareOpen = false)} onShared={handleShared} />

<PublicationConfirmDialog
	open={confirmOpen}
	postID={post.id}
	currentPublications={post.publications}
	onClose={() => (confirmOpen = false)}
	onSaved={handlePublicationsSaved}
/>

<PublicationManageSheet
	open={manageOpen}
	postID={post.id}
	publications={post.publications}
	onClose={() => (manageOpen = false)}
	onChange={handlePublicationsSaved}
/>
