<script lang="ts">
	import type { PostAttachment } from '$contracts/backend';
	import { aspectClass, getSpan, spanClass } from './mediaGridLayout';

	interface Props {
		attachments: PostAttachment[];
	}

	let { attachments }: Props = $props();
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
					<img src={a.url} alt={a.file_name} loading="lazy" class="h-full w-full object-cover" />
				{/if}
			</div>
		{/each}
	</div>
{/if}
