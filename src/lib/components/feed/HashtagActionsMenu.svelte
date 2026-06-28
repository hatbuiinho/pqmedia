<script lang="ts">
	import { clickOutside } from '$lib/utils/clickOutside';

	interface Props {
		onEdit: () => void;
		onDelete: () => void;
	}

	let { onEdit, onDelete }: Props = $props();
	let open = $state(false);

	function close() {
		open = false;
	}
</script>

<div class="relative" use:clickOutside={{ enabled: open, onDismiss: close }}>
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label="Tùy chọn hashtag"
		class="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
	>
		<span class="icon-[lucide--more-vertical] text-base" aria-hidden="true"></span>
	</button>

	{#if open}
		<div
			role="menu"
			aria-label="Tùy chọn hashtag"
			class="absolute top-8 right-0 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
		>
			<button
				type="button"
				role="menuitem"
				onclick={() => {
					close();
					onEdit();
				}}
				class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
			>
				<span class="icon-[lucide--pencil] text-base text-slate-500" aria-hidden="true"></span>
				Sửa
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={() => {
					close();
					onDelete();
				}}
				class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
			>
				<span class="icon-[lucide--trash-2] text-base" aria-hidden="true"></span>
				Xóa
			</button>
		</div>
	{/if}
</div>
