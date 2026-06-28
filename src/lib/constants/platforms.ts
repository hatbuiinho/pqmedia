import arcticonsData from '@iconify/json/json/arcticons.json';
import lucideData from '@iconify/json/json/lucide.json';
import type { Platform, PublicationPlatform } from '$contracts/backend';

export interface PlatformMeta {
	key: PublicationPlatform;
	label: string;
	/** Iconify class name (Tailwind via unplugin-icons). */
	icon: string;
	/** Tailwind colour token used for the "đã đăng" chip background. */
	tone: string;
}

export interface PlatformIconOption {
	value: string;
	label: string;
}

export interface PlatformToneOption {
	value: string;
	label: string;
	swatch: string;
}

/**
 * Single source of truth for the 7 platforms supported by post_publications.
 * Order here determines display order in every UI surface.
 */
export const DEFAULT_PLATFORMS: PlatformMeta[] = [
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

export const PLATFORM_ICON_OPTIONS: PlatformIconOption[] = [
	{ value: 'icon-[lucide--facebook]', label: 'Facebook' },
	{ value: 'icon-[lucide--instagram]', label: 'Instagram' },
	{ value: 'icon-[lucide--music-2]', label: 'TikTok' },
	{ value: 'icon-[lucide--at-sign]', label: 'Threads' },
	{ value: 'icon-[lucide--youtube]', label: 'YouTube' },
	{ value: 'icon-[lucide--twitter]', label: 'X' },
	{ value: 'icon-[lucide--message-circle-more]', label: 'Chat' },
	{ value: 'icon-[lucide--send]', label: 'Send' },
	{ value: 'icon-[lucide--globe]', label: 'Web' },
	{ value: 'icon-[lucide--image]', label: 'Image' },
	{ value: 'icon-[lucide--video]', label: 'Video' },
	{ value: 'icon-[lucide--megaphone]', label: 'Media' },
	{ value: 'icon-[lucide--radio]', label: 'Broadcast' },
	{ value: 'icon-[lucide--bookmark]', label: 'Saved' },
	{ value: 'icon-[lucide--star]', label: 'Star' },
	{ value: 'icon-[lucide--circle]', label: 'Circle' },
	{ value: 'icon-[lucide--ellipsis]', label: 'Khác' }
];

function titleCaseIconName(name: string): string {
	return name
		.split('-')
		.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
		.join(' ');
}

function humanizeArcticonsName(name: string): string {
	return name
		.replace(/^\d+-/, '')
		.split('-')
		.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
		.join(' ');
}

const lucideIconOptions: PlatformIconOption[] = Object.keys(lucideData.icons).map((name) => ({
	value: `icon-[lucide--${name}]`,
	label: titleCaseIconName(name)
}));

const arcticonsIconOptions: PlatformIconOption[] = Object.keys(arcticonsData.icons).map((name) => ({
	value: `icon-[arcticons--${name}]`,
	label: humanizeArcticonsName(name)
}));

export const PLATFORM_ICON_SEARCH_OPTIONS: PlatformIconOption[] = [
	...PLATFORM_ICON_OPTIONS,
	...lucideIconOptions.filter(
		(option) => !PLATFORM_ICON_OPTIONS.some((preset) => preset.value === option.value)
	),
	...arcticonsIconOptions.filter(
		(option) => !PLATFORM_ICON_OPTIONS.some((preset) => preset.value === option.value)
	)
];

export const PLATFORM_TONE_OPTIONS: PlatformToneOption[] = [
	{
		value: 'bg-sky-100 text-sky-700',
		label: 'Xanh dương',
		swatch: 'bg-sky-500'
	},
	{
		value: 'bg-pink-100 text-pink-700',
		label: 'Hồng',
		swatch: 'bg-pink-500'
	},
	{
		value: 'bg-rose-100 text-rose-700',
		label: 'Đỏ hồng',
		swatch: 'bg-rose-500'
	},
	{
		value: 'bg-amber-100 text-amber-700',
		label: 'Vàng',
		swatch: 'bg-amber-500'
	},
	{
		value: 'bg-emerald-100 text-emerald-700',
		label: 'Xanh lá',
		swatch: 'bg-emerald-500'
	},
	{
		value: 'bg-teal-100 text-teal-700',
		label: 'Ngọc',
		swatch: 'bg-teal-500'
	},
	{
		value: 'bg-cyan-100 text-cyan-700',
		label: 'Xanh cyan',
		swatch: 'bg-cyan-500'
	},
	{
		value: 'bg-indigo-100 text-indigo-700',
		label: 'Chàm',
		swatch: 'bg-indigo-500'
	},
	{
		value: 'bg-violet-100 text-violet-700',
		label: 'Tím',
		swatch: 'bg-violet-500'
	},
	{
		value: 'bg-zinc-200 text-zinc-800',
		label: 'Xám đậm',
		swatch: 'bg-zinc-500'
	},
	{
		value: 'bg-slate-100 text-slate-700',
		label: 'Xám',
		swatch: 'bg-slate-500'
	},
	{
		value: 'bg-slate-900 text-white',
		label: 'Nền tối',
		swatch: 'bg-slate-900'
	}
];

export function toPlatform(meta: PlatformMeta): Platform {
	return {
		key: meta.key,
		label: meta.label,
		icon: meta.icon,
		tone: meta.tone,
		sort_order: 0,
		is_active: true
	};
}

export function platformLabel(key: PublicationPlatform): string {
	return DEFAULT_PLATFORMS.find((p) => p.key === key)?.label ?? key;
}
