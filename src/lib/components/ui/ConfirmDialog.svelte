<script lang="ts">
	import ModalSurface from '$lib/components/ui/ModalSurface.svelte';
	import { buttonStyles } from '$lib/styles/buttons';

	/**
	 * Generic confirm dialog. Shown when `open` is true.
	 * Parents own the `open` state and toggle it.
	 */
	interface Props {
		open: boolean;
		title: string;
		message?: string;
		confirmText?: string;
		cancelText?: string;
		danger?: boolean;
		busy?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		open,
		title,
		message,
		confirmText = 'Xác nhận',
		cancelText = 'Huỷ',
		danger = false,
		busy = false,
		onConfirm,
		onCancel
	}: Props = $props();
</script>

{#if open}
	<ModalSurface
		{open}
		label={title}
		onClose={onCancel}
		containerClass="grid place-items-center px-4"
		panelClass="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
		overlayZClass="z-50"
		containerZClass="z-[51]"
	>
		<h2 class="text-base font-semibold text-slate-900">{title}</h2>
		{#if message}
			<p class="mt-1 text-sm text-slate-600">{message}</p>
		{/if}
		<div class="mt-4 flex items-center justify-end gap-2">
			<button
				type="button"
				onclick={onCancel}
				disabled={busy}
				class={`${buttonStyles.secondary} rounded-lg px-3 py-1.5 text-sm`}
			>
				{cancelText}
			</button>
			<button
				type="button"
				onclick={onConfirm}
				disabled={busy}
				class={`${danger ? buttonStyles.danger : buttonStyles.primary} rounded-lg px-4 py-1.5 text-sm`}
			>
				{busy ? 'Đang xử lý…' : confirmText}
			</button>
		</div>
	</ModalSurface>
{/if}
