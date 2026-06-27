<script lang="ts">
	import type { PostAttachment } from '$contracts/backend';
	import Lightbox from '$lib/components/ui/Lightbox.svelte';
	import { aspectClass, getSpan, spanClass } from './mediaGridLayout';

	interface Props {
		attachments: PostAttachment[];
	}

	let { attachments }: Props = $props();

	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);

	const imageAttachments = $derived(
		attachments.filter((attachment) => attachment.kind === 'image')
	);
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
		{#each attachments as a, idx (a.id)}
			{@const span = getSpan(idx, attachments.length)}
			<div class="{spanClass(span)} {aspectClass(span)} overflow-hidden bg-slate-200">
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
			</div>
		{/each}
	</div>

	<Lightbox items={lightboxItems} bind:open={lightboxOpen} bind:index={lightboxIndex} />
{/if}
