<script lang="ts">
	import HashtagEditor from '$lib/components/form/HashtagEditor.svelte';
	import { postComposer } from '$lib/stores/postComposer.svelte';
	import MediaPicker, { type PickerItem } from './MediaPicker.svelte';

	interface Props {
		onSubmitted?: () => void;
		autofocus?: boolean;
	}

	let { onSubmitted, autofocus = false }: Props = $props();

	const items = $derived<PickerItem[]>(
		postComposer.media.map((entry) => ({
			id: entry.id,
			kind: entry.kind,
			url: entry.url,
			file_name: entry.file.name,
			status: entry.status
		}))
	);

	const busyLabel = $derived.by(() => {
		switch (postComposer.publishStatus) {
			case 'waiting_uploads':
				return 'Đang tải lên';
			case 'publishing':
				return 'Đang đăng';
			case 'failed':
				return 'Đăng lại';
			default:
				return 'Đăng';
		}
	});

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		const accepted = await postComposer.submit();
		if (accepted) onSubmitted?.();
	}
</script>

<form
	class="flex min-h-full flex-col space-y-3 rounded-2xl bg-white p-4 shadow-sm sm:min-h-[32rem] sm:p-5"
	onsubmit={onSubmit}
>
	<HashtagEditor
		bind:value={postComposer.content}
		placeholder="Bạn đang nghĩ gì? Thêm hashtag bằng cách gõ #..."
		disabled={postComposer.isPublishingLocked}
		editorClass="min-h-40 sm:min-h-72"
		{autofocus}
	/>

	<MediaPicker
		{items}
		disabled={postComposer.isPublishingLocked}
		accept="image/*"
		addLabel="Thêm ảnh"
		onAddFiles={(files) => postComposer.addFiles(files)}
		onRemove={(id) => postComposer.removeMedia(id)}
		onReorder={(orderedIds) => postComposer.reorderMedia(orderedIds)}
	/>

	{#if postComposer.error}
		<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{postComposer.error}</p>
	{/if}

	{#if postComposer.uploadingCount > 0}
		<p class="text-xs text-slate-500">
			Đang tải {postComposer.uploadingCount} tệp lên nền. Bạn có thể đóng cửa sổ này.
		</p>
	{/if}

	<div class="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
		<p class="text-xs text-slate-500">
			{#if postComposer.publishStatus === 'waiting_uploads'}
				Bài viết sẽ tự đăng ngay khi upload xong.
			{:else if postComposer.publishStatus === 'publishing'}
				Bài viết đang được đăng nền.
			{:else if postComposer.failedCount > 0}
				Có {postComposer.failedCount} tệp tải lỗi.
			{/if}
		</p>

		<button
			type="submit"
			disabled={!postComposer.canSubmit}
			class="rounded-lg bg-[var(--app-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--app-primary-strong)] disabled:opacity-60"
		>
			{busyLabel}
		</button>
	</div>
</form>
