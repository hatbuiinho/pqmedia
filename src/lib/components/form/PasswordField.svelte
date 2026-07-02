<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props {
		value?: string;
		placeholder?: string;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		required?: boolean;
		readonly?: boolean;
		disabled?: boolean;
		minlength?: number;
		name?: string;
		id?: string;
		className?: string;
	}

	let {
		value = $bindable(''),
		placeholder,
		autocomplete,
		required = false,
		readonly = false,
		disabled = false,
		minlength,
		name,
		id,
		className = 'w-full rounded-lg border-slate-300'
	}: Props = $props();

	let visible = $state(false);
</script>

<div class="relative">
	<input
		{id}
		{name}
		type={visible ? 'text' : 'password'}
		bind:value
		{placeholder}
		{autocomplete}
		{required}
		{readonly}
		{disabled}
		{minlength}
		class={`${className} pr-11`}
	/>
	<button
		type="button"
		onclick={() => (visible = !visible)}
		class="absolute top-1/2 right-3 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
		aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
		title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
	>
		<span
			class={visible ? 'icon-[lucide--eye-off] size-4.5' : 'icon-[lucide--eye] size-4.5'}
			aria-hidden="true"
		></span>
	</button>
</div>
