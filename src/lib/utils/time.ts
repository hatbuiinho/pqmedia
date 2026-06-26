const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Vietnamese relative-time formatter — "vài giây trước", "5 phút trước", "2 giờ trước", "hôm qua", … */
export function formatRelativeVi(iso: string, now = new Date()): string {
	const date = new Date(iso);
	const diff = now.getTime() - date.getTime();
	if (diff < MINUTE) return 'vài giây trước';
	if (diff < HOUR) return `${Math.floor(diff / MINUTE)} phút trước`;
	if (diff < DAY) return `${Math.floor(diff / HOUR)} giờ trước`;
	if (diff < 2 * DAY) return 'hôm qua';
	if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} ngày trước`;
	return date.toLocaleDateString('vi-VN', { year: 'numeric', month: 'short', day: 'numeric' });
}
