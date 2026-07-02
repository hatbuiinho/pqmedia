import type { Platform, PostPublication } from '$contracts/backend';
import { listPlatforms } from '$lib/api/platforms';
import { DEFAULT_PLATFORMS, toPlatform } from '$lib/constants/platforms';

const FALLBACK_PLATFORMS = DEFAULT_PLATFORMS.map((platform, index) => ({
	...toPlatform(platform),
	sort_order: (index + 1) * 10
}));

class PlatformStore {
	items = $state<Platform[]>(FALLBACK_PLATFORMS);
	loaded = $state(false);
	loading = $state(false);

	get activeItems(): Platform[] {
		return this.items.filter((item) => item.is_active);
	}

	get activeCount(): number {
		return this.activeItems.length;
	}

	hasKey(key: string): boolean {
		return this.items.some((item) => item.key === key);
	}

	isActive(key: string): boolean {
		return this.items.some((item) => item.key === key && item.is_active);
	}

	labelOf(key: string): string {
		return this.items.find((item) => item.key === key)?.label ?? key;
	}

	metaOf(key: string): Platform | null {
		return this.items.find((item) => item.key === key) ?? null;
	}

	itemsForPublications(publications: PostPublication[]): Platform[] {
		const publishedKeys = publications.map((item) => item.platform);
		const extra = publishedKeys
			.filter((key) => !this.hasKey(key))
			.map<Platform>((key) => ({
				key,
				label: key,
				icon: 'icon-[lucide--circle]',
				tone: 'bg-slate-100 text-slate-700',
				sort_order: Number.MAX_SAFE_INTEGER,
				is_active: false
			}));
		const activeOrPublished = this.items.filter(
			(item) => item.is_active || publishedKeys.includes(item.key)
		);
		return [...activeOrPublished, ...extra];
	}

	parseActiveKeys(raw: string | null): string[] {
		if (!raw) return [];
		const allowed = new Set(this.activeItems.map((item) => item.key));
		return raw
			.split(',')
			.map((item) => item.trim())
			.filter(
				(item, index, all) => item !== '' && allowed.has(item) && all.indexOf(item) === index
			);
	}

	parseActivePublicationFilters(raw: string | null): Record<string, 'published' | 'missing'> {
		if (!raw) return {};
		const allowed = new Set(this.activeItems.map((item) => item.key));
		const next: Record<string, 'published' | 'missing'> = {};
		for (const part of raw.split(',')) {
			const [platform, state] = part.split(':').map((item) => item.trim());
			if (!platform || !state || !allowed.has(platform)) continue;
			if (state !== 'published' && state !== 'missing') continue;
			next[platform] = state;
		}
		return next;
	}

	async load(includeInactive = true) {
		this.loading = true;
		try {
			const data = await listPlatforms(includeInactive);
			this.items = data.items;
			this.loaded = true;
		} finally {
			this.loading = false;
		}
	}

	async ensureLoaded(includeInactive = true) {
		if (this.loaded || this.loading) return;
		await this.load(includeInactive);
	}

	upsert(platform: Platform) {
		const next = this.items.filter((item) => item.key !== platform.key);
		next.push(platform);
		this.items = next.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
		// store stays usable even if it was previously fallback-only
		this.loaded = true;
	}

	remove(key: string) {
		this.items = this.items.filter((item) => item.key !== key);
		this.loaded = true;
	}
}

export const platforms = new PlatformStore();
