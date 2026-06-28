<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { toasts, type ToastItem } from '$lib/stores/toast.svelte';

	function toneClasses(item: ToastItem): string {
		switch (item.tone) {
			case 'success':
				return 'border-emerald-200/90 bg-white text-slate-900';
			case 'error':
				return 'border-rose-200/90 bg-white text-slate-900';
			default:
				return 'border-[var(--app-border-strong)] bg-white text-slate-900';
		}
	}

	function toneIcon(item: ToastItem): string {
		switch (item.tone) {
			case 'success':
				return 'icon-[lucide--circle-check-big] text-emerald-600';
			case 'error':
				return 'icon-[lucide--circle-alert] text-rose-600';
			default:
				return 'icon-[lucide--bell-ring] text-[var(--app-primary-strong)]';
		}
	}

	async function onAction(item: ToastItem) {
		toasts.dismiss(item.id);
		await item.action?.onClick();
	}
</script>

{#if toasts.items.length > 0}
	<div class="pointer-events-none fixed inset-x-0 top-3 z-[60] px-3 sm:top-4">
		<div class="mx-auto flex w-full max-w-3xl flex-col gap-2 sm:items-end">
			{#each toasts.items as item (item.id)}
				<div
					in:fly={{ y: -14, duration: 220, opacity: 0 }}
					out:fade={{ duration: 180 }}
					class={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-3 shadow-[var(--app-shell-shadow)] backdrop-blur sm:max-w-sm ${toneClasses(item)}`}
					role="status"
					aria-live="polite"
				>
					<span class={`mt-0.5 shrink-0 text-lg ${toneIcon(item)}`} aria-hidden="true"></span>
					<div class="min-w-0 flex-1">
						{#if item.title}
							<div class="text-sm font-semibold">{item.title}</div>
						{/if}
						<p class="text-sm text-slate-600">{item.message}</p>
						{#if item.action}
							<button
								type="button"
								onclick={() => onAction(item)}
								class="mt-2 text-sm font-semibold text-[var(--app-primary-strong)] transition hover:text-[var(--app-primary)]"
							>
								{item.action.label}
							</button>
						{/if}
					</div>
					<button
						type="button"
						onclick={() => toasts.dismiss(item.id)}
						class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
						aria-label="Đóng thông báo"
					>
						<span class="icon-[lucide--x] size-4" aria-hidden="true"></span>
					</button>
				</div>
			{/each}
		</div>
	</div>
{/if}
