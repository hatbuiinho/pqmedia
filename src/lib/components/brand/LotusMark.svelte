<script lang="ts">
	import { base } from '$app/paths';

	interface Props {
		className?: string;
	}

	let { className = 'h-9 w-9' }: Props = $props();
</script>

<img
	src={`${base}/icons/pqmedia.png`}
	alt=""
	aria-hidden="true"
	class={`${className} object-contain`}
	draggable="false"
/>
