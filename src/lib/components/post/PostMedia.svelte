<script lang="ts">
	import type { PostAttachment } from '$contracts/backend';
	import MediaGrid from './MediaGrid.svelte';

	interface Props {
		attachments: PostAttachment[];
	}

	let { attachments }: Props = $props();
</script>

<MediaGrid {attachments} />
