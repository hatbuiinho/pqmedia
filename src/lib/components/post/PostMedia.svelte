<script lang="ts">
	import type { PostAttachment } from '$contracts/backend';

	interface Props {
		attachments: PostAttachment[];
	}

	let { attachments }: Props = $props();

	const gridClass = $derived.by(() => {
		const n = attachments.length;
		if (n <= 1) return 'grid-cols-1';
		if (n === 2) return 'grid-cols-2';
		return 'grid-cols-3';
	});
</script>

{#if attachments.length > 0}
	<div class="grid gap-1 {gridClass} overflow-hidden rounded-xl bg-slate-100">
		{#each attachments as a (a.id)}
			{#if a.kind === 'video'}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					src={a.url}
					controls
					preload="metadata"
					class="aspect-square h-full w-full object-cover"
				></video>
			{:else}
				<img
					src={a.url}
					alt={a.file_name}
					loading="lazy"
					class="aspect-square h-full w-full object-cover"
				/>
			{/if}
		{/each}
	</div>
{/if}
