<script lang="ts">
	/* eslint-disable svelte/no-at-html-tags */
	import arcticonsData from '@iconify/json/json/arcticons.json';
	import lucideData from '@iconify/json/json/lucide.json';

	interface Props {
		icon: string;
		className?: string;
		label?: string;
	}

	let { icon, className = 'size-4', label }: Props = $props();

	type IconSet = {
		width?: number;
		height?: number;
		icons: Record<string, { body: string }>;
	};

	const ICON_SETS: Record<string, IconSet> = {
		lucide: lucideData as IconSet,
		arcticons: arcticonsData as IconSet
	};

	function iconSpecFromClass(value: string): { prefix: string; name: string } | null {
		const match = value.match(/^icon-\[([a-z0-9-]+)--([a-z0-9-]+)\]$/i);
		if (!match) return null;
		return {
			prefix: match[1].toLowerCase(),
			name: match[2].toLowerCase()
		};
	}

	function svgMarkupForIcon(value: string): string {
		const fallbackSet = ICON_SETS.lucide;
		const fallbackName = 'circle';
		const spec = iconSpecFromClass(value);
		const iconSet = (spec ? ICON_SETS[spec.prefix] : null) ?? fallbackSet;
		const width = iconSet.width ?? 24;
		const height = iconSet.height ?? 24;
		const fallbackBody = fallbackSet.icons[fallbackName]?.body ?? '';
		const body = spec ? (iconSet.icons[spec.name]?.body ?? fallbackBody) : fallbackBody;
		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none">${body}</svg>`;
	}

	const markup = $derived(svgMarkupForIcon(icon));
</script>

<span
	class={`inline-flex shrink-0 items-center justify-center ${className}`}
	aria-hidden={label ? undefined : 'true'}
	aria-label={label}
>
	{@html markup}
</span>
