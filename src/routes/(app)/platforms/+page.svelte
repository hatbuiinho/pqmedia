<script lang="ts">
	import type { Platform } from '$contracts/backend';
	import {
		dragHandle,
		dragHandleZone,
		type DndEvent,
		SHADOW_ITEM_MARKER_PROPERTY_NAME
	} from 'svelte-dnd-action';
	import { untrack } from 'svelte';
	import { ApiError } from '$lib/api/client';
	import {
		createPlatform,
		deletePlatform,
		updatePlatform,
		type UpdatePlatformInput
	} from '$lib/api/platforms';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import LucideIcon from '$lib/components/ui/LucideIcon.svelte';
	import ModalSurface from '$lib/components/ui/ModalSurface.svelte';
	import {
		PLATFORM_ICON_OPTIONS,
		PLATFORM_ICON_SEARCH_OPTIONS,
		PLATFORM_TONE_OPTIONS
	} from '$lib/constants/platforms';
	import { auth } from '$lib/stores/auth.svelte';
	import { platforms } from '$lib/stores/platforms.svelte';
	import { buttonStyles } from '$lib/styles/buttons';

	interface PlatformDraft {
		key: string;
		label: string;
		icon: string;
		tone: string;
		sort_order: number;
		is_active: boolean;
	}

	type EditorMode = 'create' | 'edit';
	type SortablePlatform = Platform & { id: string };
	type ShadowSortablePlatform = SortablePlatform & {
		[SHADOW_ITEM_MARKER_PROPERTY_NAME]?: boolean;
	};

	const DEFAULT_ICON = 'icon-[lucide--circle]';
	const DEFAULT_TONE = 'bg-slate-100 text-slate-700';

	let items = $state<Platform[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let reorderSaving = $state(false);
	let dndItems = $state<SortablePlatform[]>([]);

	let editorOpen = $state(false);
	let editorMode = $state<EditorMode>('create');
	let editorKey = $state<string | null>(null);
	let editorDraft = $state<PlatformDraft>({
		key: '',
		label: '',
		icon: DEFAULT_ICON,
		tone: DEFAULT_TONE,
		sort_order: 100,
		is_active: true
	});
	let editorSaving = $state(false);
	let editorError = $state<string | null>(null);
	let iconQuery = $state('');
	let deleteConfirmOpen = $state(false);
	let deleting = $state(false);

	const isAdmin = $derived(auth.principal?.user.is_admin ?? false);
	const editorTitle = $derived(editorMode === 'create' ? 'Tạo nền tảng' : 'Chỉnh sửa nền tảng');
	const editorSubmitLabel = $derived(editorMode === 'create' ? 'Tạo mới' : 'Lưu thay đổi');
	const canDeleteCurrentPlatform = $derived(editorMode === 'edit' && !!editorKey);
	const iconSearchCount = $derived(PLATFORM_ICON_SEARCH_OPTIONS.length);
	const compactIconResults = $derived(iconQuery.trim().length > 0);
	const filteredIconOptions = $derived.by(() => {
		const query = iconQuery.trim().toLowerCase();
		if (!query) return PLATFORM_ICON_OPTIONS;
		return PLATFORM_ICON_SEARCH_OPTIONS.filter(
			(option) =>
				option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query)
		);
	});

	$effect(() => {
		const admin = isAdmin;
		if (admin) untrack(() => void load());
	});

	$effect(() => {
		if (editorMode !== 'create') return;
		const generated = slugifyLabel(editorDraft.label);
		if (editorDraft.key !== generated) {
			editorDraft = { ...editorDraft, key: generated };
		}
	});

	function slugifyLabel(label: string): string {
		return label
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/đ/gi, 'd')
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 64);
	}

	function nextSortOrder(): number {
		if (items.length === 0) return 100;
		return Math.max(...items.map((item) => item.sort_order)) + 10;
	}

	function toSortableItem(item: Platform): SortablePlatform {
		return { ...item, id: item.key };
	}

	function syncDndItems(nextItems: Platform[]) {
		dndItems = nextItems.map(toSortableItem);
	}

	function sortItems(nextItems: Platform[]): Platform[] {
		return [...nextItems].sort(
			(a, b) =>
				a.sort_order - b.sort_order || a.label.localeCompare(b.label) || a.key.localeCompare(b.key)
		);
	}

	function toDraft(platform: Platform): PlatformDraft {
		return {
			key: platform.key,
			label: platform.label,
			icon: platform.icon,
			tone: platform.tone,
			sort_order: platform.sort_order,
			is_active: platform.is_active
		};
	}

	function tonePreviewLabel(tone: string): string {
		return PLATFORM_TONE_OPTIONS.find((option) => option.value === tone)?.label ?? 'Tuỳ chọn';
	}

	function transformDraggedPlatformCard(element?: HTMLElement) {
		if (!element) return;
		const rect = element.getBoundingClientRect();
		element.style.width = `${rect.width}px`;
		element.style.height = `${rect.height}px`;
		element.style.boxSizing = 'border-box';
		element.style.display = 'flex';
		element.style.flexDirection = 'column';
		element.style.alignItems = 'stretch';
		element.style.justifyContent = 'flex-start';
		element.classList.add(
			'overflow-hidden',
			'rounded-2xl',
			'border',
			'border-slate-200',
			'bg-white'
		);
	}

	function resetEditor() {
		editorOpen = false;
		editorMode = 'create';
		editorKey = null;
		editorDraft = {
			key: '',
			label: '',
			icon: DEFAULT_ICON,
			tone: DEFAULT_TONE,
			sort_order: nextSortOrder(),
			is_active: true
		};
		editorSaving = false;
		editorError = null;
		iconQuery = '';
		deleteConfirmOpen = false;
		deleting = false;
	}

	function openCreateEditor() {
		editorMode = 'create';
		editorKey = null;
		editorDraft = {
			key: '',
			label: '',
			icon: DEFAULT_ICON,
			tone: DEFAULT_TONE,
			sort_order: nextSortOrder(),
			is_active: true
		};
		editorSaving = false;
		editorError = null;
		iconQuery = '';
		editorOpen = true;
	}

	function openEditEditor(item: Platform) {
		editorMode = 'edit';
		editorKey = item.key;
		editorDraft = toDraft(item);
		editorSaving = false;
		editorError = null;
		iconQuery = '';
		deleteConfirmOpen = false;
		deleting = false;
		editorOpen = true;
	}

	function openDeleteConfirm() {
		if (!canDeleteCurrentPlatform) return;
		deleteConfirmOpen = true;
	}

	function closeDeleteConfirm() {
		if (deleting) return;
		deleteConfirmOpen = false;
	}

	function isShadowItem(item: ShadowSortablePlatform): boolean {
		return !!item[SHADOW_ITEM_MARKER_PROPERTY_NAME];
	}

	async function load() {
		loading = true;
		error = null;
		try {
			await platforms.load(true);
			items = sortItems(platforms.items);
			syncDndItems(items);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Không tải được danh sách nền tảng';
		} finally {
			loading = false;
		}
	}

	async function onSubmitEditor(event: SubmitEvent) {
		event.preventDefault();
		if (editorSaving) return;
		editorSaving = true;
		editorError = null;

		try {
			if (editorMode === 'create') {
				const created = await createPlatform({
					key: editorDraft.key,
					label: editorDraft.label,
					icon: editorDraft.icon,
					tone: editorDraft.tone,
					sort_order: Number(editorDraft.sort_order),
					is_active: editorDraft.is_active
				});
				platforms.upsert(created);
			} else {
				if (!editorKey) return;
				const updated = await updatePlatform(editorKey, {
					label: editorDraft.label,
					icon: editorDraft.icon,
					tone: editorDraft.tone,
					sort_order: Number(editorDraft.sort_order),
					is_active: editorDraft.is_active
				} satisfies UpdatePlatformInput);
				platforms.upsert(updated);
			}

			items = sortItems(platforms.items);
			syncDndItems(items);
			resetEditor();
		} catch (err) {
			editorError =
				err instanceof ApiError
					? editorMode === 'create' && err.code === 'platform_exists'
						? 'Nền tảng này đã tồn tại.'
						: err.message
					: 'Lưu nền tảng thất bại';
		} finally {
			editorSaving = false;
		}
	}

	function onReorderConsider(event: CustomEvent<DndEvent<SortablePlatform>>) {
		dndItems = event.detail.items;
	}

	async function onReorderFinalize(event: CustomEvent<DndEvent<SortablePlatform>>) {
		dndItems = event.detail.items;
		const previous = items;
		const ordered = dndItems.map((item, index) => ({
			key: item.key,
			label: item.label,
			icon: item.icon,
			tone: item.tone,
			sort_order: (index + 1) * 10,
			is_active: item.is_active
		}));
		items = ordered;
		reorderSaving = true;
		error = null;

		try {
			const updatedItems = await Promise.all(
				ordered.map((item) =>
					updatePlatform(item.key, {
						label: item.label,
						icon: item.icon,
						tone: item.tone,
						sort_order: item.sort_order,
						is_active: item.is_active
					} satisfies UpdatePlatformInput)
				)
			);
			for (const item of updatedItems) {
				platforms.upsert(item);
			}
			items = sortItems(platforms.items);
			syncDndItems(items);
		} catch (err) {
			items = previous;
			syncDndItems(previous);
			error = err instanceof ApiError ? err.message : 'Cập nhật thứ tự thất bại';
		} finally {
			reorderSaving = false;
		}
	}

	async function onDeletePlatform() {
		if (!editorKey || deleting) return;
		deleting = true;
		editorError = null;

		try {
			await deletePlatform(editorKey);
			platforms.remove(editorKey);
			items = sortItems(platforms.items);
			syncDndItems(items);
			resetEditor();
		} catch (err) {
			editorError = err instanceof ApiError ? err.message : 'Xóa nền tảng thất bại';
			deleteConfirmOpen = false;
		} finally {
			deleting = false;
		}
	}
</script>

<section class="space-y-6">
	<div class="flex items-start justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold">Nền tảng đăng bài</h1>
			<p class="mt-1 text-sm text-slate-500">
				Quản lý danh sách nền tảng xuất hiện trong filter và trạng thái đăng bài.
			</p>
		</div>

		{#if isAdmin}
			<button
				type="button"
				onclick={openCreateEditor}
				class={`${buttonStyles.primary} rounded-xl px-4 py-2 text-sm`}
			>
				<span class="icon-[lucide--plus] text-base" aria-hidden="true"></span>
				Tạo mới
			</button>
		{/if}
	</div>

	{#if !isAdmin}
		<p class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
			Chỉ quản trị viên mới truy cập được trang này.
		</p>
	{:else}
		{#if error}
			<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
		{/if}

		<section class="rounded-2xl bg-white p-4 shadow-sm">
			<div class="mb-4 flex items-center justify-between gap-3">
				<div>
					<div class="text-sm font-medium text-slate-700">Danh sách nền tảng</div>
					<p class="mt-1 text-xs text-slate-400">
						Kéo thả card để đổi thứ tự hiển thị trong filter và trạng thái đăng bài.
					</p>
				</div>
				<div class="text-xs text-slate-500">
					{#if loading}
						Đang tải…
					{:else if reorderSaving}
						Đang lưu thứ tự…
					{:else}
						{items.length} nền tảng
					{/if}
				</div>
			</div>

			<div
				use:dragHandleZone={{
					items: dndItems,
					flipDurationMs: 180,
					dragDisabled: reorderSaving || dndItems.length < 2,
					dropTargetStyle: {},
					transformDraggedElement: transformDraggedPlatformCard
				}}
				onconsider={onReorderConsider}
				onfinalize={onReorderFinalize}
				class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
			>
				{#each dndItems as item, index (item.id)}
					{#if isShadowItem(item)}
						<div
							class="flex min-h-36 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-4"
						>
							<div class="text-center text-xs text-slate-400">
								<div class="font-medium text-slate-500">Thả vào đây</div>
								<div class="mt-1">Vị trí mới của nền tảng</div>
							</div>
						</div>
					{:else}
						<button
							type="button"
							onclick={() => openEditEditor(item)}
							disabled={reorderSaving}
							class="flex min-h-36 flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-70"
						>
							<div class="flex w-full items-start justify-between gap-3">
								<span
									class={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${item.tone}`}
								>
									<LucideIcon icon={item.icon} className="size-3.5" />
									{item.label}
								</span>

								<div class="flex items-center gap-2">
									{#if !item.is_active}
										<span class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
											Đang tắt
										</span>
									{/if}
									<span
										use:dragHandle
										class="icon-[lucide--grip-vertical] cursor-grab rounded-full p-1 text-base text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
										aria-label="Kéo để đổi thứ tự"
										title="Kéo để đổi thứ tự"
									></span>
									<span
										class="icon-[lucide--chevron-right] text-base text-slate-300"
										aria-hidden="true"
									></span>
								</div>
							</div>

							<div class="space-y-1 text-sm text-slate-700">
								<div class="font-medium">{item.label}</div>
								<div class="text-xs text-slate-500">{item.key}</div>
							</div>

							<div class="mt-auto grid w-full grid-cols-3 gap-2 text-xs text-slate-500">
								<div class="rounded-xl bg-slate-50 px-3 py-2">
									<div class="text-[11px] uppercase tracking-wide text-slate-400">Vị trí</div>
									<div class="mt-1 font-medium text-slate-700">{index + 1}</div>
								</div>
								<div class="rounded-xl bg-slate-50 px-3 py-2">
									<div class="text-[11px] uppercase tracking-wide text-slate-400">Thứ tự</div>
									<div class="mt-1 font-medium text-slate-700">{item.sort_order}</div>
								</div>
								<div class="rounded-xl bg-slate-50 px-3 py-2">
									<div class="text-[11px] uppercase tracking-wide text-slate-400">Màu</div>
									<div class="mt-1 font-medium text-slate-700">
										{tonePreviewLabel(item.tone)}
									</div>
								</div>
							</div>
						</button>
					{/if}
				{:else}
					<div
						class="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 sm:col-span-2 xl:col-span-3"
					>
						Không có nền tảng nào
					</div>
				{/each}
			</div>
		</section>
	{/if}
</section>

<ModalSurface
	open={editorOpen}
	label={editorTitle}
	onClose={resetEditor}
	containerClass="flex items-end sm:items-center sm:justify-center sm:p-4"
	panelClass="flex w-full min-h-0 max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-2xl sm:max-h-[min(88dvh,56rem)] sm:w-[min(52rem,calc(100vw-2rem))] sm:rounded-3xl"
>
	<div class="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden"></div>

	<div class="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
		<div class="min-w-0">
			<h2 class="text-base font-semibold text-slate-900">{editorTitle}</h2>
			<p class="mt-1 text-xs text-slate-500">
				{#if editorMode === 'create'}
					Tạo nền tảng mới bằng tên hiển thị, icon và màu badge.
				{:else}
					Chỉnh sửa cấu hình hiển thị của nền tảng này.
				{/if}
			</p>
		</div>
		<button
			type="button"
			onclick={resetEditor}
			class="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
			aria-label="Đóng"
		>
			<span class="icon-[lucide--x] size-5" aria-hidden="true"></span>
		</button>
	</div>

	<form class="flex min-h-0 flex-1 flex-col" onsubmit={onSubmitEditor}>
		<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
			<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
				<div class="mb-2 text-xs font-medium text-slate-600">Preview</div>
				<span
					class={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${editorDraft.tone}`}
				>
					<LucideIcon icon={editorDraft.icon} className="size-3.5" />
					{editorDraft.label.trim() || 'Nền tảng mới'}
				</span>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<label class="space-y-1">
					<span class="text-xs font-medium text-slate-600">Tên hiển thị</span>
					<input
						type="text"
						placeholder="Ví dụ: Zalo OA"
						bind:value={editorDraft.label}
						required
						class="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
					/>
				</label>

				<label class="space-y-1">
					<span class="text-xs font-medium text-slate-600">
						{editorMode === 'create' ? 'Key tự sinh' : 'Key'}
					</span>
					<input
						type="text"
						value={editorDraft.key}
						readonly
						class="w-full rounded-lg border-slate-200 bg-slate-50 text-slate-500"
					/>
				</label>

				<label class="flex items-center gap-2 pt-6 text-sm text-slate-700">
					<input
						type="checkbox"
						bind:checked={editorDraft.is_active}
						class="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
					/>
					Đang hoạt động
				</label>
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-between gap-3">
					<div>
						<div class="text-xs font-medium text-slate-600">Chọn icon</div>
						<div class="mt-1 text-[11px] text-slate-400">
							Gõ để tìm trong {iconSearchCount} icon lucide và arcticons.
							{#if compactIconResults}
								<span class="ml-1">Đang hiển thị dạng compact để xem được nhiều icon hơn.</span>
							{/if}
						</div>
					</div>
					<input
						type="search"
						placeholder="Tìm icon..."
						bind:value={iconQuery}
						class="w-full max-w-xs rounded-lg border-slate-300 text-sm focus:border-slate-500 focus:ring-slate-500"
					/>
				</div>
				<div
					class={`grid gap-2 ${
						compactIconResults
							? 'grid-cols-5 sm:grid-cols-7 lg:grid-cols-9 xl:grid-cols-10'
							: 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-7'
					}`}
				>
					{#each filteredIconOptions as option (option.value)}
						<button
							type="button"
							onclick={() => (editorDraft = { ...editorDraft, icon: option.value })}
							class={`flex items-center justify-center rounded-xl border transition ${
								editorDraft.icon === option.value
									? 'border-slate-900 bg-slate-900 text-white'
									: 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
							} ${compactIconResults ? 'h-12 px-2' : 'h-16 flex-col gap-1 text-[11px]'}`}
							aria-pressed={editorDraft.icon === option.value}
							title={option.label}
						>
							<LucideIcon
								icon={option.value}
								className={compactIconResults ? 'size-5' : 'size-4.5'}
							/>
							{#if !compactIconResults}
								<span>{option.label}</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<div class="space-y-2">
				<div class="text-xs font-medium text-slate-600">Chọn màu badge</div>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
					{#each PLATFORM_TONE_OPTIONS as option (option.value)}
						<button
							type="button"
							onclick={() => (editorDraft = { ...editorDraft, tone: option.value })}
							class={`rounded-xl border p-3 text-left transition ${
								editorDraft.tone === option.value
									? 'border-slate-900 ring-2 ring-slate-900/10'
									: 'border-slate-200 hover:border-slate-400'
							}`}
							aria-pressed={editorDraft.tone === option.value}
						>
							<div class="mb-2 flex items-center gap-2">
								<span class={`h-3 w-3 rounded-full ${option.swatch}`}></span>
								<span class="text-xs font-medium text-slate-700">{option.label}</span>
							</div>
							<span
								class={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${option.value}`}
							>
								<LucideIcon icon={editorDraft.icon} className="size-3.5" />
								{editorDraft.label.trim() || 'Preview'}
							</span>
						</button>
					{/each}
				</div>
			</div>

			{#if editorError}
				<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{editorError}</p>
			{/if}
		</div>

		<div
			class="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:px-5"
		>
			<div class="flex items-center gap-2">
				{#if canDeleteCurrentPlatform}
					<button
						type="button"
						onclick={openDeleteConfirm}
						disabled={editorSaving || deleting}
						class="rounded-lg px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
					>
						Xóa nền tảng
					</button>
				{/if}
				<div class="text-xs text-slate-400">Màu hiện tại: {tonePreviewLabel(editorDraft.tone)}</div>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={resetEditor}
					disabled={editorSaving || deleting}
					class={`${buttonStyles.secondary} rounded-lg px-3 py-2 text-sm`}
				>
					Huỷ
				</button>
				<button
					type="submit"
					disabled={editorSaving || deleting || !editorDraft.key}
					class={`${buttonStyles.primary} rounded-lg px-4 py-2 text-sm`}
				>
					{editorSaving ? 'Đang lưu…' : editorSubmitLabel}
				</button>
			</div>
		</div>
	</form>
</ModalSurface>

<ConfirmDialog
	open={deleteConfirmOpen}
	title="Xóa nền tảng?"
	message={`Nền tảng "${editorDraft.label || editorKey}" sẽ bị xóa vĩnh viễn nếu chưa được dùng trong trạng thái đăng bài.`}
	confirmText="Xóa"
	cancelText="Huỷ"
	danger={true}
	busy={deleting}
	onConfirm={onDeletePlatform}
	onCancel={closeDeleteConfirm}
/>
