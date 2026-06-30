<script lang="ts">
	import { untrack } from 'svelte';
	import type { Principal } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import {
		createUser,
		listUsers,
		resetUserPassword,
		updateUser,
		type CreateUserInput
	} from '$lib/api/users';
	import PasswordField from '$lib/components/form/PasswordField.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ModalSurface from '$lib/components/ui/ModalSurface.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { pushToast } from '$lib/stores/toast.svelte';

	const PAGE_SIZE = 20;

	type EditorMode = 'create' | 'edit';

	interface UserEditorDraft {
		email: string;
		password: string;
		full_name: string;
		phone: string;
		is_admin: boolean;
		is_active: boolean;
	}

	let users = $state<Principal[]>([]);
	let total = $state(0);
	let offset = $state(0);
	let searchQuery = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);

	let editorOpen = $state(false);
	let editorMode = $state<EditorMode>('create');
	let editorTarget = $state<Principal | null>(null);
	let editorDraft = $state<UserEditorDraft>({
		email: '',
		password: '',
		full_name: '',
		phone: '',
		is_admin: false,
		is_active: true
	});
	let editorSaving = $state(false);
	let editorError = $state<string | null>(null);

	let passwordOpen = $state(false);
	let passwordTarget = $state<Principal | null>(null);
	let passwordDraft = $state('');
	let passwordConfirmDraft = $state('');
	let passwordSaving = $state(false);
	let passwordError = $state<string | null>(null);

	let deactivateConfirmOpen = $state(false);
	let deactivateBusy = $state(false);
	let deactivateTarget = $state<Principal | null>(null);

	const isAdmin = $derived(auth.principal?.user.is_admin ?? false);
	const canPrev = $derived(offset > 0);
	const canNext = $derived(offset + users.length < total);
	const pageFrom = $derived(total === 0 ? 0 : offset + 1);
	const pageTo = $derived(offset + users.length);
	const editorTitle = $derived(editorMode === 'create' ? 'Tạo người dùng' : 'Chỉnh sửa người dùng');
	const editorSubmitLabel = $derived(editorMode === 'create' ? 'Tạo mới' : 'Lưu thay đổi');

	$effect(() => {
		const admin = isAdmin;
		if (admin) untrack(() => void load(0));
	});

	function resetEditorDraft() {
		editorDraft = {
			email: '',
			password: '',
			full_name: '',
			phone: '',
			is_admin: false,
			is_active: true
		};
	}

	function closeEditor() {
		if (editorSaving) return;
		closeEditorImmediate();
	}

	function closeEditorImmediate() {
		editorOpen = false;
		editorTarget = null;
		editorError = null;
		resetEditorDraft();
	}

	function openCreateEditor() {
		editorMode = 'create';
		editorTarget = null;
		editorError = null;
		resetEditorDraft();
		editorOpen = true;
	}

	function openEditEditor(user: Principal) {
		editorMode = 'edit';
		editorTarget = user;
		editorError = null;
		editorDraft = {
			email: user.user.email,
			password: '',
			full_name: user.profile.full_name,
			phone: user.profile.phone ?? '',
			is_admin: user.user.is_admin,
			is_active: user.user.is_active
		};
		editorOpen = true;
	}

	function openPasswordEditor(user: Principal) {
		passwordTarget = user;
		passwordDraft = '';
		passwordConfirmDraft = '';
		passwordError = null;
		passwordOpen = true;
	}

	function closePasswordEditor() {
		if (passwordSaving) return;
		passwordOpen = false;
		passwordTarget = null;
		passwordDraft = '';
		passwordConfirmDraft = '';
		passwordError = null;
	}

	async function load(nextOffset = offset) {
		loading = true;
		error = null;
		try {
			const data = await listUsers({ q: searchQuery.trim(), limit: PAGE_SIZE, offset: nextOffset });
			users = data.items;
			total = data.page.total;
			offset = nextOffset;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Không tải được danh sách người dùng';
		} finally {
			loading = false;
		}
	}

	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		void load(0);
	}

	async function submitEditor(event: SubmitEvent) {
		event.preventDefault();
		if (editorSaving) return;
		editorSaving = true;
		editorError = null;

		try {
			if (editorMode === 'create') {
				const body: CreateUserInput = {
					email: editorDraft.email.trim(),
					password: editorDraft.password,
					full_name: editorDraft.full_name.trim(),
					phone: editorDraft.phone.trim() ? editorDraft.phone.trim() : null,
					is_admin: editorDraft.is_admin
				};
				await createUser(body);
				pushToast(`Đã tạo ${body.email}`, 'success');
				closeEditorImmediate();
				await load(0);
				return;
			}

			if (!editorTarget) return;
			const updated = await updateUser(editorTarget.user.id, {
				full_name: editorDraft.full_name.trim(),
				phone: editorDraft.phone.trim() ? editorDraft.phone.trim() : null,
				is_admin: editorDraft.is_admin,
				is_active: editorDraft.is_active
			});
			users = users.map((user) => (user.user.id === updated.user.id ? updated : user));
			pushToast(`Đã cập nhật ${updated.user.email}`, 'success');
			closeEditor();
		} catch (err) {
			editorError =
				err instanceof ApiError
					? editorMode === 'create' && err.code === 'email_exists'
						? 'Email này đã tồn tại.'
						: err.message
					: 'Lưu người dùng thất bại';
		} finally {
			editorSaving = false;
		}
	}

	async function submitPasswordReset(event: SubmitEvent) {
		event.preventDefault();
		if (passwordSaving || !passwordTarget) return;
		if (passwordDraft.length < 8) {
			passwordError = 'Mật khẩu phải có ít nhất 8 ký tự';
			return;
		}
		if (passwordDraft !== passwordConfirmDraft) {
			passwordError = 'Mật khẩu xác nhận không khớp';
			return;
		}

		passwordSaving = true;
		passwordError = null;
		try {
			await resetUserPassword(passwordTarget.user.id, { password: passwordDraft });
			pushToast(`Đã đặt lại mật khẩu cho ${passwordTarget.user.email}`, 'success');
			closePasswordEditor();
		} catch (err) {
			passwordError = err instanceof ApiError ? err.message : 'Đặt lại mật khẩu thất bại';
		} finally {
			passwordSaving = false;
		}
	}

	function requestDeactivate(user: Principal) {
		deactivateTarget = user;
		deactivateConfirmOpen = true;
	}

	function closeDeactivateConfirm() {
		if (deactivateBusy) return;
		deactivateConfirmOpen = false;
		deactivateTarget = null;
	}

	async function confirmDeactivate() {
		if (!deactivateTarget || deactivateBusy) return;
		deactivateBusy = true;
		try {
			const updated = await updateUser(deactivateTarget.user.id, {
				full_name: deactivateTarget.profile.full_name,
				phone: deactivateTarget.profile.phone ?? null,
				is_admin: deactivateTarget.user.is_admin,
				is_active: false
			});
			users = users.map((user) => (user.user.id === updated.user.id ? updated : user));
			pushToast(`Đã khóa ${updated.user.email}`, 'success');
			closeDeactivateConfirm();
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Khóa tài khoản thất bại';
			deactivateBusy = false;
		} finally {
			deactivateBusy = false;
		}
	}
</script>

<section class="space-y-6">
	<div class="flex items-start justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold">Người dùng</h1>
			<p class="mt-1 text-sm text-slate-500">
				Quản lý tài khoản, phân quyền quản trị và trạng thái hoạt động.
			</p>
		</div>

		{#if isAdmin}
			<button
				type="button"
				onclick={openCreateEditor}
				class="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
			>
				<span class="icon-[lucide--user-plus] text-base" aria-hidden="true"></span>
				Tạo mới
			</button>
		{/if}
	</div>

	{#if !isAdmin}
		<p class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
			Chỉ quản trị viên mới truy cập được trang này.
		</p>
	{:else}
		<form class="flex items-center gap-2" onsubmit={submitSearch}>
			<input
				type="search"
				placeholder="Tìm theo email hoặc họ tên..."
				bind:value={searchQuery}
				class="flex-1 rounded-xl border-slate-300 bg-white focus:border-slate-500 focus:ring-slate-500"
			/>
			<button
				type="submit"
				disabled={loading}
				class="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
			>
				Tìm
			</button>
		</form>

		{#if error}
			<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
		{/if}

		<section class="rounded-2xl bg-white shadow-sm">
			<div class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
				<div class="text-xs text-slate-500">
					{#if loading}
						Đang tải…
					{:else if total === 0}
						Không có người dùng
					{:else}
						Hiển thị {pageFrom}-{pageTo} / {total} người dùng
					{/if}
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => load(Math.max(0, offset - PAGE_SIZE))}
						disabled={!canPrev || loading}
						class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
					>
						Trước
					</button>
					<button
						type="button"
						onclick={() => load(offset + PAGE_SIZE)}
						disabled={!canNext || loading}
						class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
					>
						Sau
					</button>
				</div>
			</div>

			<div class="divide-y divide-slate-100">
				{#each users as user (user.user.id)}
					<article
						class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="truncate text-sm font-semibold text-slate-900">
									{user.profile.full_name}
								</h2>
								{#if user.user.id === auth.principal?.user.id}
									<span class="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-800">
										Bạn
									</span>
								{/if}
								{#if user.user.is_admin}
									<span class="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white">
										Admin
									</span>
								{/if}
								{#if !user.user.is_active}
									<span class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
										Đang khóa
									</span>
								{/if}
							</div>
							<div class="mt-1 truncate text-sm text-slate-500">{user.user.email}</div>
							<div class="mt-1 text-xs text-slate-400">
								{user.profile.phone ? user.profile.phone : 'Chưa có số điện thoại'}
							</div>
						</div>

						<div class="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onclick={() => openEditEditor(user)}
								class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100"
							>
								Chỉnh sửa
							</button>
							<button
								type="button"
								onclick={() => openPasswordEditor(user)}
								class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100"
							>
								Đặt lại mật khẩu
							</button>
							{#if user.user.is_active}
								<button
									type="button"
									onclick={() => requestDeactivate(user)}
									class="rounded-lg border border-amber-300 px-3 py-1.5 text-xs text-amber-700 transition hover:bg-amber-50"
								>
									Khóa
								</button>
							{/if}
						</div>
					</article>
				{:else}
					<div class="px-4 py-10 text-center text-sm text-slate-500">
						{loading ? 'Đang tải…' : 'Không có người dùng nào'}
					</div>
				{/each}
			</div>
		</section>
	{/if}
</section>

<ModalSurface
	open={editorOpen}
	label={editorTitle}
	onClose={closeEditor}
	containerClass="flex items-end sm:items-center sm:justify-center sm:p-4"
	panelClass="flex w-full min-h-0 max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-2xl sm:w-[min(42rem,calc(100vw-2rem))] sm:rounded-3xl"
>
	<div class="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden"></div>
	<div class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
		<div>
			<h2 class="text-base font-semibold text-slate-900">{editorTitle}</h2>
			<p class="mt-1 text-xs text-slate-500">
				{#if editorMode === 'create'}
					Tạo tài khoản mới và gán quyền quản trị nếu cần.
				{:else}
					Cập nhật hồ sơ, quyền hạn và trạng thái hoạt động của tài khoản.
				{/if}
			</p>
		</div>
		<button
			type="button"
			onclick={closeEditor}
			class="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
			aria-label="Đóng"
		>
			<span class="icon-[lucide--x] size-5" aria-hidden="true"></span>
		</button>
	</div>

	<form class="flex min-h-0 flex-1 flex-col" onsubmit={submitEditor}>
		<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<label class="space-y-1 sm:col-span-2">
					<span class="text-xs font-medium text-slate-600">Email</span>
					<input
						type="email"
						bind:value={editorDraft.email}
						readonly={editorMode === 'edit'}
						required
						class={`w-full rounded-lg focus:border-slate-500 focus:ring-slate-500 ${
							editorMode === 'edit'
								? 'border-slate-200 bg-slate-50 text-slate-500'
								: 'border-slate-300'
						}`}
					/>
				</label>

				{#if editorMode === 'create'}
					<label class="space-y-1 sm:col-span-2">
						<span class="text-xs font-medium text-slate-600">Mật khẩu</span>
						<PasswordField
							bind:value={editorDraft.password}
							required
							minlength={8}
							placeholder="Tối thiểu 8 ký tự"
							className="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
						/>
					</label>
				{/if}

				<label class="space-y-1 sm:col-span-2">
					<span class="text-xs font-medium text-slate-600">Họ tên</span>
					<input
						type="text"
						bind:value={editorDraft.full_name}
						required
						class="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
					/>
				</label>

				<label class="space-y-1 sm:col-span-2">
					<span class="text-xs font-medium text-slate-600">Số điện thoại</span>
					<input
						type="text"
						bind:value={editorDraft.phone}
						placeholder="Tuỳ chọn"
						class="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
					/>
				</label>

				<label class="flex items-center gap-2 text-sm text-slate-700">
					<input
						type="checkbox"
						bind:checked={editorDraft.is_admin}
						class="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
					/>
					Quản trị viên
				</label>

				<label class="flex items-center gap-2 text-sm text-slate-700">
					<input
						type="checkbox"
						bind:checked={editorDraft.is_active}
						class="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
					/>
					Đang hoạt động
				</label>
			</div>

			{#if editorError}
				<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{editorError}</p>
			{/if}
		</div>

		<div class="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-4 sm:px-5">
			<button
				type="button"
				onclick={closeEditor}
				disabled={editorSaving}
				class="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 disabled:opacity-60"
			>
				Hủy
			</button>
			<button
				type="submit"
				disabled={editorSaving}
				class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
			>
				{editorSaving ? 'Đang lưu…' : editorSubmitLabel}
			</button>
		</div>
	</form>
</ModalSurface>

<ModalSurface
	open={passwordOpen}
	label="Đặt lại mật khẩu"
	onClose={closePasswordEditor}
	containerClass="flex items-end sm:items-center sm:justify-center sm:p-4"
	panelClass="flex w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
>
	<div class="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden"></div>
	<div class="border-b border-slate-200 px-4 py-4 sm:px-5">
		<h2 class="text-base font-semibold text-slate-900">Đặt lại mật khẩu</h2>
		<p class="mt-1 text-xs text-slate-500">
			{#if passwordTarget}
				Cập nhật mật khẩu mới cho {passwordTarget.user.email}.
			{/if}
		</p>
	</div>

	<form class="space-y-4 px-4 py-4 sm:px-5" onsubmit={submitPasswordReset}>
		<label class="block space-y-1">
			<span class="text-xs font-medium text-slate-600">Mật khẩu mới</span>
			<PasswordField
				bind:value={passwordDraft}
				required
				minlength={8}
				className="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
			/>
		</label>

		<label class="block space-y-1">
			<span class="text-xs font-medium text-slate-600">Xác nhận mật khẩu mới</span>
			<PasswordField
				bind:value={passwordConfirmDraft}
				required
				minlength={8}
				className="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
			/>
		</label>

		{#if passwordError}
			<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{passwordError}</p>
		{/if}

		<div class="flex items-center justify-end gap-2">
			<button
				type="button"
				onclick={closePasswordEditor}
				disabled={passwordSaving}
				class="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 disabled:opacity-60"
			>
				Hủy
			</button>
			<button
				type="submit"
				disabled={passwordSaving}
				class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
			>
				{passwordSaving ? 'Đang lưu…' : 'Cập nhật mật khẩu'}
			</button>
		</div>
	</form>
</ModalSurface>

<ConfirmDialog
	open={deactivateConfirmOpen}
	title="Khóa tài khoản?"
	message={deactivateTarget
		? `Tài khoản ${deactivateTarget.user.email} sẽ không thể đăng nhập cho đến khi được mở lại.`
		: undefined}
	confirmText="Khóa tài khoản"
	cancelText="Hủy"
	danger={true}
	busy={deactivateBusy}
	onConfirm={confirmDeactivate}
	onCancel={closeDeactivateConfirm}
/>
