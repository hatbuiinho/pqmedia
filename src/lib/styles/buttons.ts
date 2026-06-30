const base =
	'inline-flex items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';

export const buttonStyles = {
	base,
	primary: `${base} bg-[var(--app-primary-strong)] text-white hover:bg-[var(--app-primary)]`,
	secondary: `${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-100`,
	danger: `${base} bg-rose-600 text-white hover:bg-rose-700`
} as const;
