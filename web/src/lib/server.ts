import "server-only";
import { createPublicClient, http } from "viem";
import { NETWORKS, type NetKey } from "./networks";

const RPC: Record<NetKey, string | undefined> = {
  sepolia: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC,
  base: process.env.NEXT_PUBLIC_BASE_RPC,
  local: "http://127.0.0.1:8545",
};

export function clientFor(key: NetKey) {
  const net = NETWORKS[key];
  return createPublicClient({ chain: net.chain, transport: http(RPC[key]) });
}

export type XPost = { handle: string; name: string; text: string; date: string; url: string };

const decode = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&mdash;/g, "—")
    .trim();

/**
 * Reads a public X post through X's oEmbed endpoint (no API key). Returns the author's handle,
 * name and text. X can change or rate-limit this endpoint, so callers must handle null.
 */
export async function fetchXPost(handle: string, id: string): Promise<XPost | null> {
  const url = `https://x.com/${handle}/status/${id}`;
  try {
    const r = await fetch(`https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(url)}`, {
      next: { revalidate: 3600 },
      headers: { "User-Agent": "Backing/1.0 (+link preview)" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { author_name?: string; author_url?: string; html?: string };
    const author = (j.author_url ?? "").split("/").filter(Boolean).pop() ?? "";
    const html = j.html ?? "";
    const p = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const links = [...html.matchAll(/<a [^>]*>([^<]*)<\/a>/g)];
    return {
      handle: author,
      name: j.author_name ?? author,
      text: p ? decode(p[1]).replace(/\s*pic\.twitter\.com\/\S+$/, "") : "",
      date: links.length ? decode(links[links.length - 1][1]) : "",
      url,
    };
  } catch {
    return null;
  }
}
