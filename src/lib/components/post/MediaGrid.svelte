<script lang="ts">
	import type { PostAttachment } from '$contracts/backend';
	import Lightbox from '$lib/components/ui/Lightbox.svelte';
	import { aspectClass, getSpan, spanClass } from './mediaGridLayout';

	interface Props {
		attachments: PostAttachment[];
	}

	let { attachments }: Props = $props();
	const MAX_PREVIEW_ITEMS = 5;

	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);

	const imageAttachments = $derived(
		attachments.filter((attachment) => attachment.kind === 'image')
	);
	const previewAttachments = $derived(attachments.slice(0, MAX_PREVIEW_ITEMS));
	const hiddenCount = $derived(Math.max(0, attachments.length - previewAttachments.length));
	const lightboxItems = $derived(
		imageAttachments.map((attachment) => ({
			src: attachment.url,
			thumbSrc: attachment.url,
			alt: attachment.file_name,
			width: attachment.width,
			height: attachment.height
		}))
	);

	function openLightbox(attachmentID: string) {
		const index = imageAttachments.findIndex((attachment) => attachment.id === attachmentID);
		if (index < 0) return;
		lightboxIndex = index;
		lightboxOpen = true;
	}
</script>

{#if attachments.length > 0}
	<div class="grid grid-cols-6 gap-1 overflow-hidden rounded-xl bg-slate-100">
		{#each previewAttachments as a, idx (a.id)}
			{@const span = getSpan(idx, previewAttachments.length)}
			{@const isOverflowTile = hiddenCount > 0 && idx === previewAttachments.length - 1}
			<div class="{spanClass(span)} {aspectClass(span)} relative overflow-hidden bg-slate-200">
				{#if a.kind === 'video'}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video src={a.url} controls preload="metadata" class="h-full w-full object-cover"></video>
				{:else}
					<button
						type="button"
						class="block h-full w-full cursor-zoom-in"
						aria-label={`Xem ảnh ${a.file_name}`}
						onclick={() => openLightbox(a.id)}
					>
						<img
							src={a.url}
							alt={a.file_name}
							loading="lazy"
							class="h-full w-full object-cover transition hover:scale-[1.01]"
						/>
					</button>
				{/if}

				{#if isOverflowTile}
					<div
						class="pointer-events-none absolute inset-0 grid place-items-center bg-black/45 text-white"
						aria-hidden="true"
					>
						<div class="rounded-full bg-black/35 px-3 py-1 text-lg font-semibold backdrop-blur-sm">
							+{hiddenCount}
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<Lightbox items={lightboxItems} bind:open={lightboxOpen} bind:index={lightboxIndex} />
{/if}
