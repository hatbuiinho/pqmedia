<script lang="ts">
	import { onDestroy } from 'svelte';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import { aspectClass, getSpan, spanClass } from './mediaGridLayout';

	/**
	 * Generic media picker used by PostComposer (new post) and PostCard (edit mode).
	 * Smart layout (see mediaGridLayout.ts) + drag-and-drop reorder via svelte-dnd-action.
	 *
	 * The parent owns the source-of-truth state; this component only renders + fires
	 * callbacks. Blob URLs for pending files are revoked on remove / unmount to avoid
	 * leaking object URLs.
	 */

	export interface PickerItem {
		/** Stable id used as keyed-each key and passed back to callbacks. */
		id: string;
		kind: 'image' | 'video';
		/** Either MinIO public URL (existing) or a blob URL (pending). */
		url: string;
		file_name: string;
		isPending?: boolean;
	}

	interface Props {
		items: PickerItem[];
		disabled?: boolean;
		onAddFiles: (files: File[]) => void;
		onRemove: (id: string) => void;
		/** Fires when drag-drop changes order. */
		onReorder?: (orderedIds: string[]) => void;
	}

	let { items, disabled = false, onAddFiles, onRemove, onReorder }: Props = $props();

	// Writable $derived: reflects the parent's `items` by default, but onconsider
	// can overwrite it mid-drag without losing the parent-sync behaviour on the
	// next prop change. svelte-dnd-action needs a mutable list it can splice.
	let dndItems = $derived(items);

	const FLIP_MS = 180;
	const dndOptions = $derived({
		items: dndItems,
		flipDurationMs: FLIP_MS,
		dragDisabled: disabled || dndItems.length < 2,
		dropTargetStyle: {} // suppress the lib's default green outline; we style ourselves
	});

	function onConsider(e: CustomEvent<DndEvent<PickerItem>>) {
		dndItems = e.detail.items;
	}

	function onFinalize(e: CustomEvent<DndEvent<PickerItem>>) {
		dndItems = e.detail.items;
		onReorder?.(dndItems.map((i) => i.id));
	}

	// Track blob URLs the parent passed in so we can revoke them on unmount.
	const trackedBlobUrls: string[] = [];
	$effect(() => {
		for (const item of items) {
			if (item.url.startsWith('blob:') && !trackedBlobUrls.includes(item.url)) {
				trackedBlobUrls.push(item.url);
			}
		}
	});
	onDestroy(() => {
		for (const url of trackedBlobUrls) URL.revokeObjectURL(url);
		trackedBlobUrls.length = 0;
	});

	function handleAdd(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;
		onAddFiles(Array.from(input.files));
		input.value = '';
	}

	function handleRemove(item: PickerItem) {
		if (item.url.startsWith('blob:')) {
			URL.revokeObjectURL(item.url);
			const idx = trackedBlobUrls.indexOf(item.url);
			if (idx >= 0) trackedBlobUrls.splice(idx, 1);
		}
		onRemove(item.id);
	}
</script>

<div class="space-y-2">
	{#if dndItems.length > 0}
		<section
			use:dndzone={dndOptions}
			onconsider={onConsider}
			onfinalize={onFinalize}
			class="grid grid-cols-6 gap-1 overflow-hidden rounded-xl bg-slate-100"
		>
			{#each dndItems as item, idx (item.id)}
				{@const span = getSpan(idx, dndItems.length)}
				<div
					class="{spanClass(span)} {aspectClass(
						span
					)} group relative overflow-hidden rounded-md bg-slate-200"
				>
					{#if item.kind === 'video'}
						<video
							src={item.url}
							muted
							preload="metadata"
							class="pointer-events-none h-full w-full object-cover"
						></video>
						<span
							class="icon-[lucide--play] absolute top-1 left-1 rounded-full bg-black/50 p-1 text-base text-white"
							aria-hidden="true"
						></span>
					{:else}
						<img
							src={item.url}
							alt={item.file_name}
							loading="lazy"
							class="pointer-events-none h-full w-full object-cover"
						/>
					{/if}

					{#if item.isPending}
						<span
							class="absolute top-1 left-8 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white"
						>
							Chưa tải
						</span>
					{/if}

					{#if dndItems.length > 1 && !disabled}
						<span
							class="icon-[lucide--grip-vertical] absolute bottom-1 left-1 cursor-grab rounded-full bg-black/50 p-1 text-sm text-white"
							aria-hidden="true"
							title="Kéo để đổi thứ tự"
						></span>
					{/if}

					<span
						class="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums"
					>
						{idx + 1}
					</span>

					<button
						type="button"
						{disabled}
						onclick={() => handleRemove(item)}
						aria-label={`Bỏ ${item.file_name}`}
						class="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white transition hover:bg-rose-600 disabled:cursor-not-allowed"
					>
						<span class="icon-[lucide--x] text-sm" aria-hidden="true"></span>
					</button>
				</div>
			{/each}
		</section>
	{/if}

	<label
		class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 transition hover:border-slate-500 hover:text-slate-700 {disabled
			? 'pointer-events-none opacity-50'
			: ''}"
	>
		<input
			type="file"
			accept="image/*,video/*"
			multiple
			class="hidden"
			onchange={handleAdd}
			{disabled}
		/>
		<span class="icon-[lucide--plus] text-base" aria-hidden="true"></span>
		<span>Thêm ảnh / video</span>
	</label>
</div>
