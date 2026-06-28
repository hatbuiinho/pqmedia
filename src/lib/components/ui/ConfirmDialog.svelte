<script lang="ts">
	import ModalSurface from '$lib/components/ui/ModalSurface.svelte';

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
				class="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-60"
			>
				{cancelText}
			</button>
			<button
				type="button"
				onclick={onConfirm}
				disabled={busy}
				class="rounded-lg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 {danger
					? 'bg-rose-600 hover:bg-rose-700'
					: 'bg-slate-900 hover:bg-slate-800'}"
			>
				{busy ? 'Đang xử lý…' : confirmText}
			</button>
		</div>
	</ModalSurface>
{/if}
