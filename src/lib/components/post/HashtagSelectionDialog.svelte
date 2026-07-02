<script lang="ts">
	import ModalSurface from '$lib/components/ui/ModalSurface.svelte';
	import { hashtags } from '$lib/stores/hashtags.svelte';
	import { buttonStyles } from '$lib/styles/buttons';
	import { selectionStyles } from '$lib/styles/selection';
	import {
		dedupeHashtags,
		extractHashtags,
		isValidHashtagName,
		normalizeHashtag
	} from '$lib/utils/hashtags';

	interface Props {
		open: boolean;
		selected: string[];
		content?: string;
		title?: string;
		description?: string;
		confirmText?: string;
		busy?: boolean;
		error?: string | null;
		onToggle: (name: string, checked: boolean) => void;
		onClose: () => void;
		onConfirm: () => void;
	}

	let {
		open,
		selected,
		content = '',
		title = 'Gắn hashtag',
		description = 'Chọn các hashtag cần lưu cho bài viết.',
		confirmText = 'Xong',
		busy = false,
		error = null,
		onToggle,
		onClose,
		onConfirm
	}: Props = $props();

	let searchQuery = $state('');

	const normalizedSearchQuery = $derived(searchQuery.trim().toLocaleLowerCase('vi-VN'));
	const contentTags = $derived(extractHashtags(content));
	const optionNames = $derived.by(() => {
		const managedNames = hashtags.items.map((item) => item.name);
		const extraNames = dedupeHashtags([...contentTags, ...selected]).filter(
			(name) => !managedNames.includes(name)
		);
		return [...managedNames, ...extraNames];
	});
	const filteredOptions = $derived.by(() => {
		if (!normalizedSearchQuery) return optionNames;
		return optionNames.filter((name) =>
			name.toLocaleLowerCase('vi-VN').includes(normalizedSearchQuery)
		);
	});
	const exactQueryTag = $derived(normalizeHashtag(searchQuery));
	const canAddCustom = $derived(
		isValidHashtagName(exactQueryTag) && !optionNames.includes(exactQueryTag)
	);

	$effect(() => {
		if (!open) return;
		void hashtags.ensureLoaded();
		searchQuery = '';
	});

	function managedMeta(name: string) {
		return hashtags.items.find((item) => item.name === name) ?? null;
	}

	function isChecked(name: string) {
		return selected.includes(name);
	}

	function isFromContent(name: string) {
		return contentTags.includes(name);
	}

	function toggle(name: string) {
		onToggle(name, !isChecked(name));
	}
</script>

{#if open}
	<ModalSurface
		{open}
		label={title}
		{onClose}
		containerClass="grid items-end justify-center px-0 sm:place-items-center sm:px-4"
		panelClass="flex h-[min(88dvh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white p-4 shadow-2xl sm:h-[min(84dvh,44rem)] sm:rounded-2xl sm:p-5"
		overlayZClass="z-50"
		containerZClass="z-[51]"
	>
		<header class="flex items-start justify-between gap-3">
			<div>
				<h2 class="text-base font-semibold text-slate-900">{title}</h2>
				<p class="mt-1 text-xs text-slate-500">{description}</p>
			</div>
			<button
				type="button"
				onclick={onClose}
				aria-label="Đóng"
				class="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
			>
				<span class="icon-[lucide--x] text-base" aria-hidden="true"></span>
			</button>
		</header>

		<div class="mt-4 flex items-center justify-between gap-3">
			<label class="relative block flex-1">
				<span class="sr-only">Tìm hashtag</span>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Tìm hoặc nhập hashtag mới..."
					class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-10 text-sm text-slate-700 placeholder:text-slate-400"
				/>
				<span
					class="pointer-events-none absolute top-1/2 right-3 icon-[lucide--search] size-4 -translate-y-1/2 text-slate-400"
					aria-hidden="true"
				></span>
			</label>
			<div class="shrink-0 text-xs font-medium text-slate-500">{selected.length} đã chọn</div>
		</div>

		{#if selected.length > 0}
			<div class="mt-3 max-h-24 overflow-y-auto">
				<div class="flex flex-wrap gap-1.5">
					{#each selected as tag (tag)}
						<button
							type="button"
							onclick={() => onToggle(tag, false)}
							class={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${selectionStyles.softActive}`}
						>
							<span>#{tag}</span>
							<span class="icon-[lucide--x] size-3.5" aria-hidden="true"></span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div
			class="mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60"
		>
			<ul class="h-full divide-y divide-slate-100 overflow-y-auto">
				{#if canAddCustom}
					<li class="px-3 py-2">
						<button
							type="button"
							onclick={() => onToggle(exactQueryTag, true)}
							class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white"
						>
							<span
								class="grid size-5 place-items-center rounded-md bg-[var(--app-primary-soft)] text-[var(--app-primary-strong)]"
							>
								<span class="icon-[lucide--plus] size-3.5" aria-hidden="true"></span>
							</span>
							<div class="min-w-0 flex-1">
								<div class="truncate font-medium text-slate-900">Chọn #{exactQueryTag}</div>
								<div class="text-xs text-slate-500">Hashtag mới từ nội dung hoặc tìm kiếm</div>
							</div>
						</button>
					</li>
				{/if}

				{#if filteredOptions.length === 0}
					<li class="px-4 py-8 text-center text-sm text-slate-500">
						Không tìm thấy hashtag phù hợp.
					</li>
				{:else}
					{#each filteredOptions as name (name)}
						{@const meta = managedMeta(name)}
						{@const checked = isChecked(name)}
						{@const fromContent = isFromContent(name)}
						<li class="px-3 py-2">
							<button
								type="button"
								onclick={() => toggle(name)}
								aria-pressed={checked}
								class={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
									checked ? selectionStyles.cardActive : selectionStyles.cardInactive
								}`}
							>
								<input
									type="checkbox"
									{checked}
									class="size-4 shrink-0 rounded border-slate-300"
									onclick={(event) => event.stopPropagation()}
									onchange={(event) =>
										onToggle(name, (event.currentTarget as HTMLInputElement).checked)}
								/>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<span class="truncate text-sm font-medium text-current">#{name}</span>
										{#if fromContent}
											<span class="rounded-full bg-white/70 px-2 py-0.5 text-[11px] text-slate-600">
												Trong nội dung
											</span>
										{/if}
										{#if !meta}
											<span class="rounded-full bg-white/70 px-2 py-0.5 text-[11px] text-slate-600">
												Tùy chỉnh
											</span>
										{/if}
									</div>
									{#if meta}
										<div class="mt-1 text-xs text-slate-500">
											{meta.unpublished_post_count}/{meta.post_count} bài chưa đăng / tổng số bài
										</div>
									{/if}
								</div>
							</button>
						</li>
					{/each}
				{/if}
			</ul>
		</div>

		{#if error}
			<p class="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
		{/if}

		<footer class="mt-4 flex items-center justify-end gap-2">
			<button
				type="button"
				onclick={onClose}
				disabled={busy}
				class={`${buttonStyles.secondary} rounded-lg px-3 py-1.5 text-sm`}
			>
				Đóng
			</button>
			<button
				type="button"
				onclick={onConfirm}
				disabled={busy}
				class={`${buttonStyles.primary} rounded-lg px-4 py-1.5 text-sm`}
			>
				{busy ? 'Đang lưu…' : confirmText}
			</button>
		</footer>
	</ModalSurface>
{/if}
