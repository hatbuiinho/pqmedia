export interface ActiveHashtagMatch {
	query: string;
	start: number;
	end: number;
}

const HASHTAG_TOKEN_RE = /(?:^|\s)(#[\p{L}\d_]+)/gu;
const ACTIVE_HASHTAG_RE = /(?:^|\s)(#[\p{L}\d_]*)$/u;
const VALID_HASHTAG_RE = /^[\p{L}\d_]+$/u;

export function normalizeHashtag(name: string): string {
	return name.trim().replace(/^#+/, '');
}

export function dedupeHashtags(tags: string[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const tag of tags) {
		const normalized = normalizeHashtag(tag);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		out.push(normalized);
	}
	return out;
}

export function isValidHashtagName(name: string): boolean {
	const normalized = normalizeHashtag(name);
	return normalized !== '' && VALID_HASHTAG_RE.test(normalized);
}

export function extractHashtags(text: string): string[] {
	const matches = text.match(HASHTAG_TOKEN_RE) || [];
	return dedupeHashtags(matches.map((match) => match.trim().slice(1)));
}

export function applyManualHashtagSelection(
	selected: string[],
	dismissed: string[],
	content: string,
	hashtag: string,
	checked: boolean
): { selected: string[]; dismissed: string[] } {
	const normalized = normalizeHashtag(hashtag);
	if (!normalized) {
		return { selected: dedupeHashtags(selected), dismissed: dedupeHashtags(dismissed) };
	}

	const nextSelected = dedupeHashtags(selected);
	const selectedSet = new Set(nextSelected);
	const nextDismissed = dedupeHashtags(dismissed);
	const dismissedSet = new Set(nextDismissed);
	const inContent = extractHashtags(content).includes(normalized);

	if (checked) {
		if (!selectedSet.has(normalized)) nextSelected.push(normalized);
		dismissedSet.delete(normalized);
	} else {
		const index = nextSelected.indexOf(normalized);
		if (index !== -1) nextSelected.splice(index, 1);
		if (inContent) dismissedSet.add(normalized);
		else dismissedSet.delete(normalized);
	}

	return {
		selected: nextSelected,
		dismissed: Array.from(dismissedSet)
	};
}

export function findActiveHashtag(textBeforeCaret: string): ActiveHashtagMatch | null {
	const match = textBeforeCaret.match(ACTIVE_HASHTAG_RE);
	if (!match) return null;

	return {
		query: match[1].slice(1),
		start: textBeforeCaret.length - match[1].length,
		end: textBeforeCaret.length
	};
}
