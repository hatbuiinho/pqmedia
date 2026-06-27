<script lang="ts">
	import type { AttachmentKind, PostAttachmentInput } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { createPost } from '$lib/api/posts';
	import { uploadFile, type UploadResult } from '$lib/api/uploads';
	import HashtagEditor from '$lib/components/form/HashtagEditor.svelte';

	interface Props {
		onCreated: (postID: string) => void;
	}

	let { onCreated }: Props = $props();

	let content = $state('');

	// Extract hashtags from content
	const extractedHashtags = $derived.by(() => {
		const matches = content.match(/(?:^|\s)(#[\p{L}\d_]+)/gu) || [];
		return Array.from(new Set(matches.map((m) => m.trim().slice(1))));
	});
	let pending = $state<File[]>([]);
	let uploaded = $state<UploadResult[]>([]);
	let busy = $state(false);
	let error = $state<string | null>(null);

	const hasMedia = $derived(uploaded.length > 0 || pending.length > 0);
	const canSubmit = $derived((content.trim() !== '' || hasMedia) && !busy);

	function pickFiles(event: Event) {
		const target = event.target as HTMLInputElement;
		if (!target.files) return;
		pending = [...pending, ...Array.from(target.files)];
		target.value = '';
	}

	function removePending(idx: number) {
		pending = pending.filter((_, i) => i !== idx);
	}

	function removeUploaded(idx: number) {
		uploaded = uploaded.filter((_, i) => i !== idx);
	}

	async function uploadPending(): Promise<UploadResult[]> {
		const out: UploadResult[] = [];
		for (const file of pending) {
			const kind: AttachmentKind = file.type.startsWith('video/') ? 'video' : 'image';
			out.push(await uploadFile(file, kind));
		}
		return out;
	}

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;
		busy = true;
		error = null;
		try {
			const fresh = await uploadPending();
			const allAttachments = [...uploaded, ...fresh];
			const inputs: PostAttachmentInput[] = allAttachments.map((a, sort_order) => ({
				kind: a.kind as AttachmentKind,
				file_name: a.file_name,
				content_type: a.content_type,
				bucket: a.bucket,
				object_key: a.object_key,
				size_bytes: a.size_bytes,
				width: a.width ?? null,
				height: a.height ?? null,
				duration_ms: a.duration_ms ?? null,
				sort_order
			}));
			const post = await createPost({
				content: content.trim(),
				attachments: inputs,
				hashtags: extractedHashtags
			});
			content = '';
			pending = [];
			uploaded = [];
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

	{#if pending.length > 0 || uploaded.length > 0}
		<div class="flex flex-wrap gap-2 text-xs text-slate-600">
			{#each uploaded as u, i (u.object_key)}
				<span class="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
					✓ {u.file_name}
					<button
						type="button"
						class="text-slate-500 hover:text-rose-600"
						onclick={() => removeUploaded(i)}
						aria-label="Bỏ tệp đã tải"
					>
						×
					</button>
				</span>
			{/each}
			{#each pending as f, i (f.name + i)}
				<span class="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-800">
					⌛ {f.name}
					<button
						type="button"
						class="text-amber-700 hover:text-rose-600"
						onclick={() => removePending(i)}
						aria-label="Bỏ tệp"
					>
						×
					</button>
				</span>
			{/each}
		</div>
	{/if}

	{#if error}
		<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
	{/if}

	<div class="flex items-center justify-between">
		<label
			class="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
		>
			<input
				type="file"
				accept="image/*,video/*"
				multiple
				class="hidden"
				onchange={pickFiles}
				disabled={busy}
			/>
			Thêm ảnh / video
		</label>
		<button
			type="submit"
			disabled={!canSubmit}
			class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
		>
			{busy ? 'Đang đăng…' : 'Đăng'}
		</button>
	</div>
</form>
