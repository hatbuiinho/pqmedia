// SPA mode for the entire site — every page renders client-side.
// `+page.ts` / `+layout.ts` load functions still run, but only in the browser.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
