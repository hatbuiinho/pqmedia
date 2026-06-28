import {
	createHashtag,
	deleteHashtag,
	listManagedHashtags,
	updateHashtag,
	type ManagedHashtag
} from '$lib/api/hashtags';

class HashtagStore {
	items = $state<ManagedHashtag[]>([]);
	loaded = $state(false);
	loading = $state(false);

	async load(force = false) {
		if (this.loading || (this.loaded && !force)) return;
		this.loading = true;
		try {
			const data = await listManagedHashtags(undefined, 200);
			this.items = data.items;
			this.loaded = true;
		} finally {
			this.loading = false;
		}
	}

	async ensureLoaded() {
		await this.load(false);
	}

	async refresh() {
		await this.load(true);
	}

	async create(name: string) {
		const item = await createHashtag(name);
		this.upsert(item);
		return item;
	}

	async update(currentName: string, name: string) {
		const item = await updateHashtag(currentName, name);
		this.items = this.items.filter((entry) => entry.name !== currentName);
		this.upsert(item);
		return item;
	}

	async delete(name: string) {
		await deleteHashtag(name);
		this.remove(name);
	}

	upsert(item: ManagedHashtag) {
		const next = this.items.filter((entry) => entry.name !== item.name && entry.id !== item.id);
		next.push(item);
		this.items = next.sort((a, b) => b.post_count - a.post_count || a.name.localeCompare(b.name));
		this.loaded = true;
	}

	remove(name: string) {
		this.items = this.items.filter((entry) => entry.name !== name);
	}
}

export const hashtags = new HashtagStore();
