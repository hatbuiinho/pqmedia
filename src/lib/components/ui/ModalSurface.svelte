<script lang="ts">
	import { clickOutside } from '$lib/utils/clickOutside';

	interface Props {
		open: boolean;
		label: string;
		onClose: () => void;
		containerClass?: string;
		panelClass?: string;
		overlayClass?: string;
		overlayZClass?: string;
		containerZClass?: string;
		children?: import('svelte').Snippet;
	}

	let {
		open,
		label,
		onClose,
		containerClass = 'grid items-end justify-center sm:items-center',
		panelClass = 'w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl',
		overlayClass = 'bg-black/40 backdrop-blur-sm',
		overlayZClass = 'z-40',
		containerZClass = 'z-50',
		children
	}: Props = $props();
</script>

{#if open}
	<div class={`fixed inset-0 ${overlayZClass} ${overlayClass}`} role="presentation"></div>
	<div class={`fixed inset-0 ${containerZClass} ${containerClass}`} role="presentation">
		<div
			role="dialog"
			aria-modal="true"
			aria-label={label}
			tabindex="-1"
			class={panelClass}
			use:clickOutside={{ enabled: open, onDismiss: onClose }}
		>
			{@render children?.()}
		</div>
	</div>
{/if}
