/** X (Twitter) helpers. No API key needed: links, post intents and the public oEmbed endpoint. */

export const cleanHandle = (h: string) => h.trim().replace(/^@/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 15);

/** The code a creator posts on X to link it to their wallet. */
export const linkCode = (address: string) => `bk-${address.slice(2, 10).toLowerCase()}`;

export function parseXPost(url?: string): { handle: string; id: string } | null {
  if (!url) return null;
  const m = url.match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{5,25})/);
  return m ? { handle: m[1], id: m[2] } : null;
}

export const xPostUrl = (handle: string, id: string) => `https://x.com/${handle}/status/${id}`;
export const xProfileUrl = (handle: string) => `https://x.com/${handle}`;

export function xIntent(text: string, url?: string) {
  const q = new URLSearchParams({ text });
  if (url) q.set("url", url);
  return `https://x.com/intent/post?${q.toString()}`;
}
