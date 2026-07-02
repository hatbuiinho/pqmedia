<script lang="ts">
	import HashtagEditor from '$lib/components/form/HashtagEditor.svelte';
	import { selectionStyles } from '$lib/styles/selection';
	import { buttonStyles } from '$lib/styles/buttons';
	import { postComposer } from '$lib/stores/postComposer.svelte';
	import HashtagSelectionDialog from './HashtagSelectionDialog.svelte';
	import MediaPicker, { type PickerItem } from './MediaPicker.svelte';

	interface Props {
		onSubmitted?: () => void;
		autofocus?: boolean;
	}

	let { onSubmitted, autofocus = false }: Props = $props();
	let hashtagDialogOpen = $state(false);

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
		value={postComposer.content}
		placeholder="Bạn đang nghĩ gì? Thêm hashtag bằng cách gõ #..."
		disabled={postComposer.isPublishingLocked}
		editorClass="min-h-40 sm:min-h-72"
		onValueChange={(value) => postComposer.setContent(value)}
		onSelectHashtag={(hashtag) => postComposer.selectHashtag(hashtag)}
		{autofocus}
	/>

	<div
		class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
	>
		<div class="min-w-0">
			<div class="text-xs font-medium text-slate-600">Hashtag sẽ lưu</div>
			<div class="mt-1 flex flex-wrap gap-1.5">
				{#if postComposer.selectedHashtags.length > 0}
					{#each postComposer.selectedHashtags as tag (tag)}
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
			disabled={postComposer.isPublishingLocked}
			onclick={() => (hashtagDialogOpen = true)}
			class={`${buttonStyles.secondary} rounded-full px-3 py-1.5 text-xs`}
		>
			<span class="icon-[lucide--tags] text-sm" aria-hidden="true"></span>
			Hashtag{postComposer.selectedHashtags.length > 0
				? ` (${postComposer.selectedHashtags.length})`
				: ''}
		</button>
	</div>

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
			class={`${buttonStyles.primary} rounded-lg px-4 py-2 text-sm`}
		>
			{busyLabel}
		</button>
	</div>
</form>

<HashtagSelectionDialog
	open={hashtagDialogOpen}
	selected={postComposer.selectedHashtags}
	content={postComposer.content}
	title="Gắn hashtag cho bài viết"
	description="Checkbox là nguồn lưu cuối. Hashtag gõ trong nội dung chỉ được lưu khi vẫn đang được chọn."
	onToggle={(name, checked) => postComposer.toggleHashtag(name, checked)}
	onClose={() => (hashtagDialogOpen = false)}
	onConfirm={() => (hashtagDialogOpen = false)}
/>
