export const selectionStyles = {
	pillActive:
		'bg-[var(--app-primary-soft)] text-[var(--app-primary-strong)] hover:bg-[var(--app-primary-soft)]',
	pillInactive: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
	solidActive: 'border-[var(--app-primary-strong)] bg-[var(--app-primary-strong)] text-white',
	outlineInactive:
		'border-slate-200 bg-white text-slate-700 hover:border-[var(--app-border-strong)] hover:bg-slate-50',
	cardActive:
		'border-[var(--app-primary-strong)] bg-[var(--app-primary-soft)] text-[var(--app-primary-strong)]',
	cardInactive: 'border-slate-200 bg-white text-slate-700 hover:border-[var(--app-border-strong)]',
	softActive: 'bg-[var(--app-primary-soft)] text-[var(--app-primary-strong)]'
} as const;
