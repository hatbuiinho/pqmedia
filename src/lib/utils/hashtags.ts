export interface ActiveHashtagMatch {
	query: string;
	start: number;
	end: number;
}

const HASHTAG_TOKEN_RE = /(?:^|\s)(#[\p{L}\d_]+)/gu;
const ACTIVE_HASHTAG_RE = /(?:^|\s)(#[\p{L}\d_]*)$/u;

export function extractHashtags(text: string): string[] {
	const matches = text.match(HASHTAG_TOKEN_RE) || [];
	return Array.from(new Set(matches.map((match) => match.trim().slice(1))));
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
