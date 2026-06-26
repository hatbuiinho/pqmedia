<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { ApiError } from '$lib/api/client';
	import { markAllNotificationsRead, markNotificationRead } from '$lib/api/notifications';
	import { notifications } from '$lib/stores/notifications.svelte';
	import { formatRelativeVi } from '$lib/utils/time';

	function withBase(path: string): string {
		if (path.startsWith('http')) return path;
		return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
	}

	function onOpen(routeURL: string | null) {
		if (!routeURL) return;
		window.location.assign(withBase(routeURL));
	}

	let loading = $state(false);
	let error = $state<string | null>(null);

	onMount(() => {
		void load();
	});

	async function load() {
		loading = true;
		error = null;
		try {
			await notifications.refresh();
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Không tải được thông báo';
		} finally {
			loading = false;
		}
	}

	async function onMarkRead(id: string) {
		try {
			await markNotificationRead(id);
			notifications.markRead(id);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Cập nhật thất bại';
		}
	}

	async function onMarkAll() {
		try {
			await markAllNotificationsRead();
			notifications.markAllRead();
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Cập nhật thất bại';
		}
	}
</script>

<section class="space-y-4">
	<header class="flex items-center justify-between">
		<h1 class="text-xl font-semibold">Thông báo</h1>
		{#if notifications.unreadCount > 0}
			<button type="button" class="text-sm text-slate-500 hover:text-slate-900" onclick={onMarkAll}>
				Đánh dấu đã đọc tất cả
			</button>
		{/if}
	</header>

	{#if loading}
		<p class="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">Đang tải…</p>
	{:else if error}
		<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
	{:else if notifications.items.length === 0}
		<p class="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
			Chưa có thông báo nào.
		</p>
	{:else}
		<ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm">
			{#each notifications.items as n (n.id)}
				<li class="flex items-start gap-3 px-4 py-3 {n.read_at ? 'opacity-70' : ''}">
					{#if !n.read_at}
						<span class="mt-1.5 h-2 w-2 rounded-full bg-slate-900" aria-hidden="true"></span>
					{:else}
						<span class="mt-1.5 h-2 w-2" aria-hidden="true"></span>
					{/if}
					<div class="flex-1 text-sm">
						<div class="font-medium text-slate-900">{n.title}</div>
						{#if n.body}
							<div class="text-slate-700">{n.body}</div>
						{/if}
						<div class="text-xs text-slate-500">{formatRelativeVi(n.created_at)}</div>
					</div>
					<div class="flex flex-col items-end gap-1">
						{#if n.route_url}
							<button
								type="button"
								onclick={() => onOpen(n.route_url)}
								class="text-xs text-slate-500 hover:text-slate-900"
							>
								Xem
							</button>
						{/if}
						{#if !n.read_at}
							<button
								type="button"
								onclick={() => onMarkRead(n.id)}
								class="text-xs text-slate-500 hover:text-slate-900"
							>
								Đã đọc
							</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
