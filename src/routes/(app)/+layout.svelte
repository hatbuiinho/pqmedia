<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { fetchMe, logout } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import ProfileMenu from '$lib/components/layout/ProfileMenu.svelte';
	import PostComposer from '$lib/components/post/PostComposer.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { APP_NAME } from '$lib/env';
	import { clickOutside } from '$lib/utils/clickOutside';

	let { children } = $props();
	let composerOpen = $state(false);

	// Bottom-nav stays focused on browsing actions. Hồ sơ + admin + logout live
	// in the profile dropdown (ProfileMenu) at the top-right of the topbar.
	const navItems = [
		{ href: resolve('/feed'), label: 'Bảng tin', icon: 'icon-[lucide--newspaper]' },
		{
			href: resolve('/posts/new'),
			label: 'Đăng bài',
			icon: 'icon-[lucide--square-pen]',
			compose: true
		},
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

	function openComposer() {
		composerOpen = true;
	}

	function closeComposer() {
		composerOpen = false;
	}

	async function onComposerCreated() {
		composerOpen = false;
		await goto(resolve('/feed'), {
			replaceState: page.url.pathname === resolve('/feed'),
			invalidateAll: true
		});
	}
</script>

<div class="flex min-h-dvh flex-col bg-slate-50">
	<header class="sticky top-0 z-30 border-b border-slate-200/80 bg-white/88 backdrop-blur">
		<div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
			<a href={resolve('/feed')} class="font-semibold text-slate-900">{APP_NAME}</a>
			<ProfileMenu onLogout={() => onLogout()} />
		</div>
	</header>

	<main class="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-32">
		{@render children()}
	</main>

	<nav
		aria-label="Điều hướng chính"
		class="fixed bottom-4 left-1/2 z-30 grid w-[min(calc(100%-1.5rem),48rem)] -translate-x-1/2 grid-cols-3 gap-2 rounded-[1.4rem] border bg-white/92 p-2 shadow-[var(--app-shell-shadow)] backdrop-blur-xl [border-color:var(--app-border-strong)]"
	>
		{#each navItems as item (item.href)}
			{@const active = page.url.pathname.startsWith(item.href)}
			{#if item.compose}
				<button
					type="button"
					title={item.label}
					aria-label={item.label}
					aria-haspopup="dialog"
					aria-expanded={composerOpen}
					onclick={openComposer}
					class="grid justify-items-center rounded-2xl bg-linear-to-r from-[var(--app-primary)] to-[var(--app-secondary)] px-2 py-3 text-[0.77rem] font-bold text-white shadow-[0_12px_28px_rgba(91,108,255,0.18)] transition active:translate-y-px sm:gap-1 sm:py-2.5"
				>
					<span class="{item.icon} text-2xl sm:text-xl" aria-hidden="true"></span>
					<span class="sr-only sm:not-sr-only">{item.label}</span>
				</button>
			{:else}
				<a
					href={item.href}
					title={item.label}
					aria-label={item.label}
					aria-current={active ? 'page' : undefined}
					class="grid justify-items-center rounded-2xl px-2 py-3 text-[0.77rem] font-semibold transition active:translate-y-px sm:gap-1 sm:py-2.5 {active
						? 'bg-[var(--app-primary-soft)] text-[var(--app-primary-strong)] shadow-sm ring-1 ring-[color:var(--app-border-strong)]'
						: 'text-slate-500 hover:bg-white/80 hover:text-slate-900'}"
				>
					<span class="{item.icon} text-2xl sm:text-xl" aria-hidden="true"></span>
					<span class="sr-only sm:not-sr-only">{item.label}</span>
				</a>
			{/if}
		{/each}
	</nav>
</div>

{#if composerOpen}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
		aria-label="Đóng trình tạo bài viết"
		onclick={closeComposer}
	></button>
	<div
		role="dialog"
		aria-modal="true"
		aria-label="Tạo bài viết"
		tabindex="-1"
		class="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-slate-50 p-4 shadow-2xl sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:w-[min(42rem,calc(100vw-2rem))] sm:max-h-[calc(100dvh-4rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
		use:clickOutside={{ enabled: composerOpen, onDismiss: closeComposer }}
		onclick={(event) => event.stopPropagation()}
		onkeydown={(event) => event.stopPropagation()}
	>
		<div class="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden"></div>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-base font-semibold text-slate-900">Đăng bài</h2>
			<button
				type="button"
				onclick={closeComposer}
				class="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
				aria-label="Đóng"
			>
				<span class="icon-[lucide--x] size-5" aria-hidden="true"></span>
			</button>
		</div>

		<PostComposer autofocus onCreated={() => onComposerCreated()} />
	</div>
{/if}
