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
	import { uploadFile, type UploadResult } from '$lib/api/uploads';
	import { canManagePublications } from '$lib/auth/access';
	import { auth } from '$lib/stores/auth.svelte';
	import { hashtags } from '$lib/stores/hashtags.svelte';
	import { buttonStyles } from '$lib/styles/buttons';
	import { selectionStyles } from '$lib/styles/selection';
	import { applyManualHashtagSelection, dedupeHashtags } from '$lib/utils/hashtags';
	import { formatRelativeVi } from '$lib/utils/time';
	import HashtagEditor from '$lib/components/form/HashtagEditor.svelte';
	import CommentList from './CommentList.svelte';
	import HashtagSelectionDialog from './HashtagSelectionDialog.svelte';
	import MediaPicker, { type PickerItem } from './MediaPicker.svelte';
	import PostActionsMenu from './PostActionsMenu.svelte';
	import PostContentPreview from './PostContentPreview.svelte';
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
	const canManagePostPublications = $derived(canManagePublications(auth.principal));

	// `untrack` keeps Svelte from warning about reading a reactive prop at $state
	// init: we deliberately want the initial value only — subsequent toggles are local.
	let commentsOpen = $state(untrack(() => startWithCommentsOpen));

	const commentLabel = $derived(
		post.comment_count === 0 ? 'Bình luận' : `${post.comment_count} bình luận`
	);

	let shareOpen = $state(false);
	let confirmOpen = $state(false);
	let manageOpen = $state(false);
	let quickHashtagOpen = $state(false);
	let quickHashtagSaving = $state(false);

	// Inline edit state. Content + hashtags + attachments are editable.
	let isEditing = $state(false);
	let editDraft = $state('');
	let editSelectedHashtags = $state<string[]>([]);
	let editDismissedContentHashtags = $state<string[]>([]);
	let editSaving = $state(false);
	let editError = $state<string | null>(null);
	let editHashtagOpen = $state(false);
	let quickHashtagDraft = $state<string[]>([]);
	let quickDismissedContentHashtags = $state<string[]>([]);
	let quickHashtagError = $state<string | null>(null);

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
		status: 'uploading' | 'uploaded' | 'failed';
		uploaded?: UploadResult;
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
						status: 'uploaded'
					}
				: {
						id: e.id,
						kind: e.mediaKind,
						url: e.url,
						file_name: e.file.name,
						status: e.status
					}
		)
	);
	const editUploadingCount = $derived(
		editMedia.filter((e) => e.kind === 'pending' && e.status === 'uploading').length
	);
	const editFailedCount = $derived(
		editMedia.filter((e) => e.kind === 'pending' && e.status === 'failed').length
	);

	function handleShared() {
		if (!canManagePostPublications) return;
		// Native share resolved → ask user which platforms they actually posted to.
		confirmOpen = true;
	}

	function handlePublicationsSaved(publications: PostPublication[]) {
		onPublicationsChange?.(post.id, publications);
	}

	function startEdit() {
		editDraft = post.content;
		editSelectedHashtags = dedupeHashtags(post.hashtags ?? []);
		editDismissedContentHashtags = [];
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
		editHashtagOpen = false;
	}

	function addEditFiles(files: File[]) {
		const next: PendingEntry[] = files.map((file) => ({
			kind: 'pending',
			id: `pending-${++pendingCounter}`,
			mediaKind: file.type.startsWith('video/') ? 'video' : 'image',
			file,
			url: URL.createObjectURL(file),
			status: 'uploading'
		}));
		editMedia = [...editMedia, ...next];
		editError = null;
		for (const entry of next) void uploadEditEntry(entry.id);
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
		if (current.length !== editSelectedHashtags.length) return true;
		const sortedA = [...current].sort();
		const sortedB = [...editSelectedHashtags].sort();
		return sortedA.some((t, i) => t !== sortedB[i]);
	}

	function toggleEditHashtag(name: string, checked: boolean) {
		const next = applyManualHashtagSelection(
			editSelectedHashtags,
			editDismissedContentHashtags,
			editDraft,
			name,
			checked
		);
		editSelectedHashtags = next.selected;
		editDismissedContentHashtags = next.dismissed;
	}

	function selectEditHashtag(name: string) {
		toggleEditHashtag(name, true);
	}

	function openQuickHashtags() {
		quickHashtagDraft = dedupeHashtags(post.hashtags ?? []);
		quickDismissedContentHashtags = [];
		quickHashtagError = null;
		quickHashtagOpen = true;
	}

	function toggleQuickHashtag(name: string, checked: boolean) {
		const next = applyManualHashtagSelection(
			quickHashtagDraft,
			quickDismissedContentHashtags,
			post.content,
			name,
			checked
		);
		quickHashtagDraft = next.selected;
		quickDismissedContentHashtags = next.dismissed;
	}

	async function saveQuickHashtags() {
		if (quickHashtagSaving) return;
		quickHashtagSaving = true;
		quickHashtagError = null;
		try {
			const updated = await updatePost(post.id, { hashtags: quickHashtagDraft });
			onPostUpdated?.(updated);
			void hashtags.refresh();
			quickHashtagOpen = false;
		} catch (err) {
			quickHashtagError = err instanceof ApiError ? err.message : 'Lưu hashtag thất bại';
		} finally {
			quickHashtagSaving = false;
		}
	}

	async function uploadEditEntry(id: string) {
		const entry = editMedia.find((item) => item.id === id);
		if (!entry || entry.kind !== 'pending') return;
		try {
			const uploaded = await uploadFile(entry.file, entry.mediaKind);
			if (!editMedia.some((item) => item.id === id && item.kind === 'pending')) return;
			editMedia = editMedia.map((item) =>
				item.kind === 'pending' && item.id === id ? { ...item, status: 'uploaded', uploaded } : item
			);
		} catch (err) {
			if (!editMedia.some((item) => item.id === id && item.kind === 'pending')) return;
			editMedia = editMedia.map((item) =>
				item.kind === 'pending' && item.id === id ? { ...item, status: 'failed' } : item
			);
			editError = err instanceof ApiError ? err.message : 'Tải ảnh/video lên thất bại';
		}
	}

	function buildAttachmentInputs(): PostAttachmentInput[] {
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
				out.push({
					kind: entry.mediaKind,
					file_name: entry.uploaded!.file_name,
					content_type: entry.uploaded!.content_type,
					bucket: entry.uploaded!.bucket,
					object_key: entry.uploaded!.object_key,
					size_bytes: entry.uploaded!.size_bytes,
					width: entry.uploaded!.width ?? null,
					height: entry.uploaded!.height ?? null,
					duration_ms: entry.uploaded!.duration_ms ?? null,
					sort_order
				});
			}
		}
		return out;
	}

	async function saveEdit() {
		if (editSaving) return;
		if (editUploadingCount > 0) {
			editError = 'Ảnh/video vẫn đang tải lên. Chờ tải xong rồi lưu.';
			return;
		}
		if (editFailedCount > 0) {
			editError = 'Có tệp tải lỗi. Hãy bỏ tệp lỗi và thêm lại trước khi lưu.';
			return;
		}
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
			if (tagsChanged) body.hashtags = editSelectedHashtags;
			if (mediaChanged) body.attachments = buildAttachmentInputs();
			const updated = await updatePost(post.id, body);
			onPostUpdated?.(updated);
			void hashtags.refresh();
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
			onDelete={() => onDelete?.(post.id)}
		/>
	</header>

	{#if isEditing}
		<div class="space-y-3">
			<HashtagEditor
				value={editDraft}
				placeholder="Sửa nội dung. Thêm hashtag bằng cách gõ #..."
				onValueChange={(value) => (editDraft = value)}
				onSelectHashtag={selectEditHashtag}
			/>
			<div
				class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
			>
				<div class="min-w-0">
					<div class="text-xs font-medium text-slate-600">Hashtag sẽ lưu</div>
					<div class="mt-1 flex flex-wrap gap-1.5">
						{#if editSelectedHashtags.length > 0}
							{#each editSelectedHashtags as tag (tag)}
								<span
									class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${selectionStyles.softActive}`}
								>
									#{tag}
								</span>
							{/each}
						{:else}
							<span class="text-xs text-slate-400">Chưa chọn hashtag nào</span>
						{/if}
					</div>
				</div>
				<button
					type="button"
					disabled={editSaving}
					onclick={() => (editHashtagOpen = true)}
					class={`${buttonStyles.secondary} rounded-full px-3 py-1.5 text-xs`}
				>
					<span class="icon-[lucide--tags] text-sm" aria-hidden="true"></span>
					Hashtag{editSelectedHashtags.length > 0 ? ` (${editSelectedHashtags.length})` : ''}
				</button>
			</div>
			<MediaPicker
				items={editItems}
				disabled={editSaving}
				onAddFiles={addEditFiles}
				onRemove={removeEditItem}
				onReorder={reorderEditItems}
			/>
			{#if editUploadingCount > 0}
				<p class="text-xs text-slate-500">
					Đang tải {editUploadingCount} tệp lên nền. Có thể tiếp tục sửa nội dung trong lúc chờ.
				</p>
			{:else if editFailedCount > 0}
				<p class="text-xs text-rose-600">
					Có {editFailedCount} tệp tải lỗi. Bỏ tệp lỗi và thêm lại trước khi lưu.
				</p>
			{/if}
			{#if editError}
				<p class="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{editError}</p>
			{/if}
			<div class="flex items-center justify-end gap-2">
				<button
					type="button"
					onclick={cancelEdit}
					disabled={editSaving}
					class={`${buttonStyles.secondary} rounded-lg px-3 py-1.5 text-xs`}
				>
					Huỷ
				</button>
				<button
					type="button"
					onclick={saveEdit}
					disabled={editSaving || editUploadingCount > 0 || editFailedCount > 0}
					class={`${buttonStyles.primary} rounded-lg px-3 py-1.5 text-xs`}
				>
					{editSaving ? 'Đang lưu…' : 'Lưu'}
				</button>
			</div>
		</div>
	{:else if post.content}
		<PostContentPreview content={post.content} />
	{/if}

	{#if (post.hashtags && post.hashtags.length > 0) || canEdit}
		<div class="flex flex-wrap items-center gap-2">
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
			{#if canEdit && !isEditing}
				<button
					type="button"
					onclick={openQuickHashtags}
					class={`${buttonStyles.secondary} rounded-full px-3 py-1.5 text-xs`}
				>
					<span class="icon-[lucide--tags] text-sm" aria-hidden="true"></span>
					{post.hashtags.length > 0 ? 'Sửa hashtag' : '+ Hashtag'}
				</button>
			{/if}
		</div>
	{/if}

	{#if !isEditing}
		<PostMedia attachments={post.attachments} />
	{/if}

	<div class="border-t border-slate-100 pt-3">
		<PublicationStatus
			publications={post.publications}
			disabled={!canManagePostPublications}
			onOpenManage={() => (manageOpen = true)}
		/>
	</div>

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

		<div class="ml-auto flex items-center gap-3">
			<button
				type="button"
				onclick={() => (shareOpen = true)}
				class="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
				aria-label="Chia sẻ bài viết"
				title="Chia sẻ"
			>
				<span class="icon-[lucide--share-2] text-base" aria-hidden="true"></span>
			</button>

			<ReactionControl
				targetType="post"
				targetID={post.id}
				summaries={post.reactions}
				onChange={(s) => onReactionsChange?.(post.id, s)}
			/>
		</div>
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

<HashtagSelectionDialog
	open={editHashtagOpen}
	selected={editSelectedHashtags}
	content={editDraft}
	title="Gắn hashtag cho bài viết"
	description="Checkbox là nguồn lưu cuối. Hashtag trong nội dung chỉ được lưu khi vẫn đang được chọn."
	onToggle={toggleEditHashtag}
	onClose={() => (editHashtagOpen = false)}
	onConfirm={() => (editHashtagOpen = false)}
/>

<HashtagSelectionDialog
	open={quickHashtagOpen}
	selected={quickHashtagDraft}
	content={post.content}
	title="Cập nhật hashtag"
	description="Giữ link hashtag để lọc nhanh, và dùng bảng này để quyết định hashtag nào thực sự được lưu."
	confirmText="Lưu hashtag"
	busy={quickHashtagSaving}
	error={quickHashtagError}
	onToggle={toggleQuickHashtag}
	onClose={() => {
		if (quickHashtagSaving) return;
		quickHashtagOpen = false;
		quickHashtagError = null;
	}}
	onConfirm={saveQuickHashtags}
/>
