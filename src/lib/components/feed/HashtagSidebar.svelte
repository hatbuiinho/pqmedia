<script lang="ts">
	import { ApiError } from '$lib/api/client';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ModalSurface from '$lib/components/ui/ModalSurface.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { hashtags } from '$lib/stores/hashtags.svelte';
	import { buttonStyles } from '$lib/styles/buttons';
	import { selectionStyles } from '$lib/styles/selection';
	import { pushToast } from '$lib/stores/toast.svelte';
	import HashtagActionsMenu from './HashtagActionsMenu.svelte';

	interface Props {
		activeHashtag: string;
		onSelect: (name: string) => void;
		onClear: () => void;
		loading?: boolean;
		mobile?: boolean;
		onRequestClose?: () => void;
	}

	let {
		activeHashtag,
		onSelect,
		onClear,
		loading = false,
		mobile = false,
		onRequestClose
	}: Props = $props();

	type EditorMode = 'create' | 'edit';

	let editorOpen = $state(false);
	let editorMode = $state<EditorMode>('create');
	let editorName = $state('');
	let editorOriginalName = $state('');
	let editorBusy = $state(false);
	let editorError = $state<string | null>(null);
	let deleteTarget = $state<string | null>(null);
	let deleteBusy = $state(false);
	let searchQuery = $state('');
	let editorInput = $state<HTMLInputElement | null>(null);

	const isAdmin = $derived(auth.principal?.user.is_admin ?? false);
	const normalizedSearchQuery = $derived(searchQuery.trim().toLocaleLowerCase('vi-VN'));
	const filteredHashtags = $derived.by(() => {
		if (!normalizedSearchQuery) return hashtags.items;
		return hashtags.items.filter((item) =>
			item.name.toLocaleLowerCase('vi-VN').includes(normalizedSearchQuery)
		);
	});

	$effect(() => {
		void hashtags.ensureLoaded();
	});

	$effect(() => {
		if (!editorOpen || !editorInput) return;
		editorInput.focus();
		editorInput.select();
	});

	function closeMobileDrawer() {
		onRequestClose?.();
	}

	function openCreate() {
		editorMode = 'create';
		editorName = '';
		editorOriginalName = '';
		editorError = null;
		editorBusy = false;
		editorOpen = true;
	}

	function openEdit(name: string) {
		editorMode = 'edit';
		editorName = name;
		editorOriginalName = name;
		editorError = null;
		editorBusy = false;
		editorOpen = true;
	}

	function closeEditor() {
		if (editorBusy) return;
		editorOpen = false;
		editorError = null;
	}

	async function submitEditor(event: SubmitEvent) {
		event.preventDefault();
		if (editorBusy) return;
		editorBusy = true;
		editorError = null;
		try {
			if (editorMode === 'create') {
				const created = await hashtags.create(editorName);
				pushToast(`Đã tạo #${created.name}`, 'success');
			} else {
				const updated = await hashtags.update(editorOriginalName, editorName);
				if (activeHashtag === editorOriginalName) {
					onSelect(updated.name);
				}
				pushToast(`Đã cập nhật #${updated.name}`, 'success');
			}
			editorOpen = false;
		} catch (err) {
			editorError = err instanceof ApiError ? err.message : 'Lưu hashtag thất bại';
		} finally {
			editorBusy = false;
		}
	}

	async function confirmDelete() {
		if (!deleteTarget || deleteBusy) return;
		deleteBusy = true;
		try {
			const target = deleteTarget;
			await hashtags.delete(target);
			if (activeHashtag === target) {
				onClear();
			}
			pushToast(`Đã xóa #${target}`, 'success');
			deleteTarget = null;
		} catch (err) {
			pushToast(err instanceof ApiError ? err.message : 'Xóa hashtag thất bại', 'error');
		} finally {
			deleteBusy = false;
		}
	}

	function onClickHashtag(name: string) {
		if (activeHashtag === name) {
			onClear();
		} else {
			onSelect(name);
		}
		closeMobileDrawer();
	}
</script>

<div class={`flex h-full min-h-0 flex-col space-y-3 ${mobile ? 'px-4 py-4' : ''}`}>
	<div class="rounded-2xl bg-white p-3 shadow-sm">
		<div class="flex items-start justify-between gap-3">
			<div>
				<div class="text-sm font-semibold text-slate-900">Hashtag</div>
				<p class="mt-1 text-xs text-slate-500">Bấm để lọc bài viết theo hashtag.</p>
			</div>
			{#if isAdmin}
				<button
					type="button"
					onclick={openCreate}
					class={`${buttonStyles.primary} h-9 rounded-full px-3 text-xs`}
				>
					<span class="icon-[lucide--plus] text-sm" aria-hidden="true"></span>
					Thêm mới
				</button>
			{/if}
		</div>

		{#if activeHashtag}
			<button
				type="button"
				onclick={() => {
					onClear();
					closeMobileDrawer();
				}}
				class={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${selectionStyles.softActive}`}
			>
				#{activeHashtag}
				{#if loading}
					<span
						class="icon-[lucide--loader-circle] size-3.5 animate-spin"
						aria-label="Đang tải bài viết theo hashtag"
					></span>
				{/if}
				<span class="icon-[lucide--x] size-3.5" aria-hidden="true"></span>
			</button>
		{/if}
	</div>

	<div class="flex min-h-0 flex-1 flex-col rounded-2xl bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-slate-100 px-3 py-2">
			<div class="text-xs font-medium text-slate-500">
				{hashtags.loading
					? 'Đang tải…'
					: `${filteredHashtags.length} / ${hashtags.items.length} hashtag`}
			</div>
		</div>

		<div class="border-b border-slate-100 px-3 py-2.5">
			<label class="relative block">
				<span class="sr-only">Tìm hashtag</span>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Tìm hashtag..."
					class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-10 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100"
				/>
				<span
					class="pointer-events-none absolute top-1/2 right-3 icon-[lucide--search] size-4 -translate-y-1/2 text-slate-400"
					aria-hidden="true"
				></span>
			</label>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if hashtags.items.length === 0 && !hashtags.loading}
				<div class="px-3 py-6 text-center text-sm text-slate-500">Chưa có hashtag nào.</div>
			{:else if filteredHashtags.length === 0}
				<div class="px-3 py-6 text-center text-sm text-slate-500">
					Không tìm thấy hashtag phù hợp.
				</div>
			{:else}
				<ul class="divide-y divide-slate-100">
					{#each filteredHashtags as item (item.id)}
						<li class="px-2 py-1.5">
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => onClickHashtag(item.name)}
									aria-pressed={activeHashtag === item.name}
									class={`flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition ${
										activeHashtag === item.name
											? selectionStyles.cardActive
											: 'hover:bg-slate-50 text-slate-700'
									}`}
								>
									<div class="min-w-0">
										<div class="truncate text-sm font-medium">#{item.name}</div>
										<div class="text-[11px] text-slate-400">
											{item.unpublished_post_count} chưa đăng / {item.post_count} bài viết
										</div>
									</div>
									{#if loading && activeHashtag === item.name}
										<span
											class="icon-[lucide--loader-circle] size-4 shrink-0 animate-spin text-slate-400"
											aria-label="Đang tải bài viết theo hashtag"
										></span>
									{:else}
										<span
											class="icon-[lucide--chevron-right] shrink-0 text-slate-300"
											aria-hidden="true"
										></span>
									{/if}
								</button>

								{#if isAdmin}
									<HashtagActionsMenu
										onEdit={() => openEdit(item.name)}
										onDelete={() => (deleteTarget = item.name)}
									/>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

<ModalSurface
	open={editorOpen}
	label={editorMode === 'create' ? 'Tạo hashtag' : 'Chỉnh sửa hashtag'}
	onClose={closeEditor}
	containerClass="flex items-end sm:items-center sm:justify-center sm:p-4"
	panelClass="flex w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
>
	<div class="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden"></div>
	<div class="border-b border-slate-100 px-4 py-4 sm:px-5">
		<h2 class="text-base font-semibold text-slate-900">
			{editorMode === 'create' ? 'Tạo hashtag mới' : 'Chỉnh sửa hashtag'}
		</h2>
		<p class="mt-1 text-xs text-slate-500">Chỉ nhập tên hashtag, không cần ký tự #.</p>
	</div>

	<form class="space-y-4 px-4 py-4 sm:px-5" onsubmit={submitEditor}>
		<label class="block space-y-1">
			<span class="text-xs font-medium text-slate-600">Tên hashtag</span>
			<input
				bind:this={editorInput}
				type="text"
				bind:value={editorName}
				placeholder="Ví dụ: phatphap"
				required
				class="w-full rounded-xl border-slate-300"
			/>
		</label>

		{#if editorError}
			<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{editorError}</p>
		{/if}

		<div class="flex items-center justify-end gap-2">
			<button
				type="button"
				onclick={closeEditor}
				disabled={editorBusy}
				class={`${buttonStyles.secondary} rounded-lg px-3 py-2 text-sm`}
			>
				Hủy
			</button>
			<button
				type="submit"
				disabled={editorBusy || editorName.trim() === ''}
				class={`${buttonStyles.primary} rounded-lg px-4 py-2 text-sm`}
			>
				{editorBusy ? 'Đang lưu…' : editorMode === 'create' ? 'Tạo mới' : 'Lưu thay đổi'}
			</button>
		</div>
	</form>
</ModalSurface>

<ConfirmDialog
	open={deleteTarget !== null}
	title="Xóa hashtag?"
	message={deleteTarget ? `Hashtag #${deleteTarget} sẽ bị gỡ khỏi toàn bộ bài viết.` : undefined}
	confirmText="Xóa"
	cancelText="Hủy"
	danger={true}
	busy={deleteBusy}
	onConfirm={confirmDelete}
	onCancel={() => {
		if (!deleteBusy) deleteTarget = null;
	}}
/>
