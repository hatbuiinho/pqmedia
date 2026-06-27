<script lang="ts">
	import type { AttachmentKind, PostAttachmentInput } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { createPost } from '$lib/api/posts';
	import { uploadFile } from '$lib/api/uploads';
	import HashtagEditor from '$lib/components/form/HashtagEditor.svelte';
	import MediaPicker, { type PickerItem } from './MediaPicker.svelte';

	interface Props {
		onCreated: (postID: string) => void;
	}

	let { onCreated }: Props = $props();

	let content = $state('');

	const extractedHashtags = $derived.by(() => {
		const matches = content.match(/(?:^|\s)(#[\p{L}\d_]+)/gu) || [];
		return Array.from(new Set(matches.map((m) => m.trim().slice(1))));
	});

	// Pending files keep their own blob URL for preview; we upload them on submit.
	interface PendingMedia {
		id: string;
		file: File;
		kind: AttachmentKind;
		url: string;
	}
	let pending = $state<PendingMedia[]>([]);
	let busy = $state(false);
	let error = $state<string | null>(null);

	let pendingCounter = 0;

	const items = $derived<PickerItem[]>(
		pending.map((p) => ({
			id: p.id,
			kind: p.kind,
			url: p.url,
			file_name: p.file.name,
			isPending: true
		}))
	);

	const hasMedia = $derived(pending.length > 0);
	const canSubmit = $derived((content.trim() !== '' || hasMedia) && !busy);

	function addFiles(files: File[]) {
		const next: PendingMedia[] = files.map((file) => ({
			id: `pending-${++pendingCounter}`,
			file,
			kind: file.type.startsWith('video/') ? 'video' : 'image',
			url: URL.createObjectURL(file)
		}));
		pending = [...pending, ...next];
	}

	function removeItem(id: string) {
		pending = pending.filter((p) => p.id !== id);
	}

	function reorderItems(orderedIds: string[]) {
		const byId = new Map(pending.map((p) => [p.id, p]));
		pending = orderedIds.map((id) => byId.get(id)).filter((p): p is PendingMedia => !!p);
	}

	async function uploadPending(): Promise<PostAttachmentInput[]> {
		const out: PostAttachmentInput[] = [];
		for (const [sort_order, p] of pending.entries()) {
			const uploaded = await uploadFile(p.file, p.kind);
			out.push({
				kind: p.kind,
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
		return out;
	}

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;
		busy = true;
		error = null;
		try {
			const attachments = await uploadPending();
			const post = await createPost({
				content: content.trim(),
				attachments,
				hashtags: extractedHashtags
			});
			content = '';
			for (const p of pending) URL.revokeObjectURL(p.url);
			pending = [];
			onCreated(post.id);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Đăng bài thất bại';
		} finally {
			busy = false;
		}
	}
</script>

<form class="space-y-3 rounded-2xl bg-white p-4 shadow-sm" onsubmit={onSubmit}>
	<HashtagEditor
		bind:value={content}
		placeholder="Bạn đang nghĩ gì? Thêm hashtag bằng cách gõ #..."
	/>

	<MediaPicker
		{items}
		disabled={busy}
		onAddFiles={addFiles}
		onRemove={removeItem}
		onReorder={reorderItems}
	/>

	{#if error}
		<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
	{/if}

	<div class="flex items-center justify-end">
		<button
			type="submit"
			disabled={!canSubmit}
			class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
		>
			{busy ? 'Đang đăng…' : 'Đăng'}
		</button>
	</div>
</form>
