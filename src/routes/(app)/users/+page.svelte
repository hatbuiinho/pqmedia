<script lang="ts">
	import { untrack } from 'svelte';
	import type { Principal } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { createUser, listUsers } from '$lib/api/users';
	import { auth } from '$lib/stores/auth.svelte';

	let users = $state<Principal[]>([]);
	let total = $state(0);
	let q = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);

	let form = $state({ email: '', password: '', full_name: '', is_admin: false });
	let creating = $state(false);
	let formError = $state<string | null>(null);

	const isAdmin = $derived(auth.principal?.user.is_admin ?? false);

	// Reload when admin flag flips on; keep load() untracked so writes inside
	// (loading/users/total) don't re-trigger the effect.
	$effect(() => {
		const admin = isAdmin;
		if (admin) untrack(() => void load());
	});

	async function load() {
		loading = true;
		error = null;
		try {
			const data = await listUsers({ q, limit: 50 });
			users = data.items;
			total = data.page.total;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Không tải được danh sách';
		} finally {
			loading = false;
		}
	}

	async function onCreate(event: SubmitEvent) {
		event.preventDefault();
		if (creating) return;
		creating = true;
		formError = null;
		try {
			await createUser({ ...form });
			form = { email: '', password: '', full_name: '', is_admin: false };
			await load();
		} catch (err) {
			formError = err instanceof ApiError ? err.message : 'Tạo thất bại';
		} finally {
			creating = false;
		}
	}
</script>

<section class="space-y-6">
	<h1 class="text-xl font-semibold">Người dùng</h1>

	{#if !isAdmin}
		<p class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
			Chỉ quản trị viên mới truy cập được trang này.
		</p>
	{:else}
		<form class="space-y-3 rounded-2xl bg-white p-4 shadow-sm" onsubmit={onCreate}>
			<h2 class="text-sm font-semibold text-slate-700">Thêm người dùng</h2>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<input
					type="email"
					placeholder="Email"
					bind:value={form.email}
					required
					class="rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
				/>
				<input
					type="password"
					placeholder="Mật khẩu (≥ 8 ký tự)"
					bind:value={form.password}
					required
					minlength="8"
					class="rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
				/>
				<input
					type="text"
					placeholder="Họ tên"
					bind:value={form.full_name}
					required
					class="rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500 sm:col-span-2"
				/>
				<label class="flex items-center gap-2 text-sm text-slate-700">
					<input
						type="checkbox"
						bind:checked={form.is_admin}
						class="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
					/>
					Quản trị viên
				</label>
			</div>
			{#if formError}
				<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
			{/if}
			<button
				type="submit"
				disabled={creating}
				class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
			>
				{creating ? 'Đang tạo…' : 'Thêm'}
			</button>
		</form>

		<div class="flex items-center gap-2">
			<input
				type="search"
				placeholder="Tìm theo email hoặc họ tên…"
				bind:value={q}
				onkeydown={(e) => e.key === 'Enter' && load()}
				class="flex-1 rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
			/>
			<button
				type="button"
				onclick={load}
				class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
			>
				Tìm
			</button>
		</div>

		{#if error}
			<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
		{/if}

		<div class="overflow-hidden rounded-2xl bg-white shadow-sm">
			<div class="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
				{loading ? 'Đang tải…' : `${total} người dùng`}
			</div>
			<ul class="divide-y divide-slate-100">
				{#each users as p (p.user.id)}
					<li class="flex items-center justify-between px-4 py-3 text-sm">
						<div>
							<div class="font-medium text-slate-900">{p.profile.full_name}</div>
							<div class="text-slate-500">{p.user.email}</div>
						</div>
						<div class="flex items-center gap-2 text-xs">
							{#if p.user.is_admin}
								<span class="rounded-full bg-slate-900 px-2 py-0.5 text-white">Admin</span>
							{/if}
							{#if !p.user.is_active}
								<span class="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Tắt</span>
							{/if}
						</div>
					</li>
				{:else}
					<li class="px-4 py-6 text-center text-sm text-slate-500">Không có người dùng nào</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>
