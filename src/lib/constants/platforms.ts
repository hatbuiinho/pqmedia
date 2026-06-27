import type { PublicationPlatform } from '$contracts/backend';

export interface PlatformMeta {
	key: PublicationPlatform;
	label: string;
	/** Iconify class name (Tailwind via unplugin-icons). */
	icon: string;
	/** Tailwind colour token used for the "đã đăng" chip background. */
	tone: string;
}

/**
 * Single source of truth for the 7 platforms supported by post_publications.
 * Order here determines display order in every UI surface.
 */
export const PLATFORMS: PlatformMeta[] = [
	{
		key: 'facebook',
		label: 'Facebook',
		icon: 'icon-[lucide--facebook]',
		tone: 'bg-sky-100 text-sky-700'
	},
	{
		key: 'instagram',
		label: 'Instagram',
		icon: 'icon-[lucide--instagram]',
		tone: 'bg-pink-100 text-pink-700'
	},
	{
		key: 'tiktok',
		label: 'TikTok',
		icon: 'icon-[lucide--music-2]',
		tone: 'bg-slate-200 text-slate-800'
	},
	{
		key: 'threads',
		label: 'Threads',
		icon: 'icon-[lucide--at-sign]',
		tone: 'bg-zinc-200 text-zinc-800'
	},
	{
		key: 'youtube',
		label: 'YouTube',
		icon: 'icon-[lucide--youtube]',
		tone: 'bg-rose-100 text-rose-700'
	},
	{ key: 'x', label: 'X', icon: 'icon-[lucide--twitter]', tone: 'bg-slate-900 text-white' },
	{
		key: 'other',
		label: 'Khác',
		icon: 'icon-[lucide--ellipsis]',
		tone: 'bg-slate-100 text-slate-700'
	}
];

export const PLATFORM_KEYS: PublicationPlatform[] = PLATFORMS.map((p) => p.key);
export const PLATFORM_COUNT = PLATFORMS.length;

export function platformLabel(key: PublicationPlatform): string {
	return PLATFORMS.find((p) => p.key === key)?.label ?? key;
}
