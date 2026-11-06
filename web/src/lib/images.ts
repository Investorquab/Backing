import { SITE_URL } from "./networks";

/**
 * Only show pictures from places we trust: our own site (demo images, local uploads) and the image
 * store we upload to. Anything else on-chain (it's public) is ignored, so a post can't load
 * tracking pixels or arbitrary content into people's feeds.
 */
const EXTRA = (process.env.NEXT_PUBLIC_IMAGE_HOSTS || "public.blob.vercel-storage.com")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function safeImage(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/") || url.startsWith("/demo/")) return url;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && u.hostname === "localhost")) return null;
    const host = u.hostname.toLowerCase();
    const site = new URL(SITE_URL).hostname.toLowerCase();
    if (host === site || host === "localhost") return url;
    // Always trust images served from the same origin the app is loaded from (covers alternate vercel.app domains).
    if (typeof window !== "undefined" && host === window.location.hostname.toLowerCase()) return url;
    if (EXTRA.some((h) => host === h || host.endsWith("." + h))) return url;
    return null;
  } catch {
    return null;
  }
}
