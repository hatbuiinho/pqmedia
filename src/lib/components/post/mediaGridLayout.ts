// Smart media-grid layout shared by PostMedia (display) and MediaPicker (edit/preview).
// All grids use grid-cols-6 so each tile picks a `col-span-*` that fits the count.
//
// Rules avoid orphaned tiles by widening items in incomplete rows:
//   1 item     -> 1 full-width tile (aspect-video)
//   2 items    -> 2 half-width tiles
//   3 items    -> 3 tiles in a row
//   4 items    -> 2x2 (each half-width)
//   5 items    -> row 1: 2 half-width, row 2: 3 third-width
//   6 items    -> 2 rows of 3
//   7+ items   -> 3 cols; the remainder of the last partial row is stretched
//                 (1 leftover → full row; 2 leftovers → two halves)

const FULL = 6;
const HALF = 3;
const THIRD = 2;

export function getSpan(idx: number, count: number): number {
	if (count <= 1) return FULL;
	if (count === 2) return HALF;
	if (count === 3) return THIRD;
	if (count === 4) return HALF;
	if (count === 5) return idx < 2 ? HALF : THIRD;
	if (count === 6) return THIRD;

	const tail = count % 3;
	const fullRowsEnd = count - tail;
	if (idx < fullRowsEnd) return THIRD;
	if (tail === 1) return FULL;
	if (tail === 2) return HALF;
	return THIRD;
}

/** Tailwind class for the computed col-span. Static strings so Tailwind keeps them. */
export function spanClass(span: number): string {
	switch (span) {
		case 6:
			return 'col-span-6';
		case 3:
			return 'col-span-3';
		case 2:
			return 'col-span-2';
		default:
			return 'col-span-2';
	}
}

/** Wide single-tile gets a 16:9 frame so it never balloons vertically; the rest stay square. */
export function aspectClass(span: number): string {
	return span === FULL ? 'aspect-video' : 'aspect-square';
}
