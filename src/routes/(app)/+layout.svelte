<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { fetchMe, logout } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import ProfileMenu from '$lib/components/layout/ProfileMenu.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { APP_NAME } from '$lib/env';

	let { children } = $props();

	// Bottom-nav stays focused on browsing actions. Hồ sơ + admin + logout live
	// in the profile dropdown (ProfileMenu) at the top-right of the topbar.
	const navItems = [
		{ href: resolve('/feed'), label: 'Bảng tin', icon: 'icon-[lucide--newspaper]' },
		{ href: resolve('/posts/new'), label: 'Đăng bài', icon: 'icon-[lucide--square-pen]' },
		{ href: resolve('/notifications'), label: 'Thông báo', icon: 'icon-[lucide--bell]' }
	];

	// Refresh principal once when the protected shell mounts. Kept out of +layout.ts
	// load() because writing to $state from there can re-trigger load(), and SvelteKit
	// also warns when load() uses window.fetch instead of event.fetch.
	onMount(async () => {
		try {
			await fetchMe();
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				auth.clear();
				await goto(resolve('/login'), { replaceState: true });
			}
		}
	});

	async function onLogout() {
		await logout();
		await goto(resolve('/login'), { replaceState: true });
	}
</script>

<div class="flex min-h-dvh flex-col bg-slate-50">
	<header class="sticky top-0 z-10 border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
			<a href={resolve('/feed')} class="font-semibold text-slate-900">{APP_NAME}</a>
			<ProfileMenu onLogout={() => onLogout()} />
		</div>
	</header>

	<main class="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-24">
		{@render children()}
	</main>

	<nav
		class="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
	>
		<div class="mx-auto flex max-w-3xl">
			{#each navItems as item (item.href)}
				{@const active = page.url.pathname.startsWith(item.href)}
				<a
					href={item.href}
					title={item.label}
					aria-label={item.label}
					aria-current={active ? 'page' : undefined}
					class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition sm:gap-1 sm:py-2.5 {active
						? 'text-slate-900'
						: 'text-slate-500 hover:text-slate-900'}"
				>
					<span class="{item.icon} text-2xl sm:text-xl" aria-hidden="true"></span>
					<span class="hidden sm:inline">{item.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
