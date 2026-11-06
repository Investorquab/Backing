import { isAddress } from "viem";

/**
 * GET /api/farcaster — a thin, cached proxy to Neynar so the NEYNAR_API_KEY stays server-side.
 * Ops:
 *   ?op=user&username=dwr              one Farcaster user
 *   ?op=search&q=vita                  user search (type-ahead)
 *   ?op=byAddress&address=0x..,0x..    the Farcaster account(s) that VERIFIED these wallets
 *   ?op=casts&fid=3&limit=10           a user's recent casts
 * byAddress is the trustless join: Farcaster records which wallets belong to an account, and the
 * Backing contract keys profiles by wallet — so we can link the two with no contract change and
 * no way to spoof someone else's identity.
 */
export const runtime = "nodejs";

const BASE = "https://api.neynar.com/v2/farcaster";

type NeynarUser = {
  fid: number;
  username: string;
  display_name?: string;
  pfp_url?: string;
  follower_count?: number;
  custody_address?: string;
  profile?: { bio?: { text?: string } };
  verified_addresses?: { eth_addresses?: string[] };
  verified_accounts?: { platform?: string; username?: string }[];
};

export type FcUser = {
  fid: number;
  username: string;
  displayName: string;
  pfp: string;
  bio: string;
  followerCount: number;
  addresses: string[];
  x?: string;
};

export type FcCast = {
  hash: string;
  text: string;
  timestamp: number;
  images: string[];
  likes: number;
  recasts: number;
  replies: number;
  url: string;
};

function normUser(u: NeynarUser): FcUser {
  const eth = (u.verified_addresses?.eth_addresses ?? []).map((a) => a.toLowerCase());
  const custody = u.custody_address ? [u.custody_address.toLowerCase()] : [];
  return {
    fid: u.fid,
    username: u.username,
    displayName: u.display_name || u.username,
    pfp: u.pfp_url || "",
    bio: u.profile?.bio?.text || "",
    followerCount: u.follower_count || 0,
    addresses: Array.from(new Set([...eth, ...custody])),
    x: u.verified_accounts?.find((a) => a.platform === "x")?.username || undefined,
  };
}

const isImg = (url?: string): url is string => !!url && /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url);

/* eslint-disable @typescript-eslint/no-explicit-any */
function normCast(c: any): FcCast {
  const raw = c?.timestamp;
  const ts = typeof raw === "number" ? (raw < 1e12 ? raw * 1000 : raw) : Date.parse(raw);
  const embeds: any[] = Array.isArray(c?.embeds) ? c.embeds : [];
  const images = embeds
    .map((e) => (isImg(e?.url) ? e.url : e?.metadata?.content_type?.startsWith?.("image") ? e.url : undefined))
    .filter((u: unknown): u is string => typeof u === "string" && /^https:\/\//.test(u));
  const username = c?.author?.username || "";
  return {
    hash: String(c?.hash ?? ""),
    text: c?.text || "",
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
    images,
    likes: c?.reactions?.likes_count ?? 0,
    recasts: c?.reactions?.recasts_count ?? 0,
    replies: c?.replies?.count ?? 0,
    url: username ? `https://warpcast.com/${username}/${String(c?.hash ?? "").slice(0, 10)}` : `https://warpcast.com/~/conversations/${c?.hash}`,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(req: Request) {
  const key = process.env.NEYNAR_API_KEY;
  if (!key) return Response.json({ error: "Farcaster isn't configured" }, { status: 503 });

  const url = new URL(req.url);
  const op = url.searchParams.get("op");
  const cache = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };
  const call = async (path: string) => {
    const r = await fetch(`${BASE}${path}`, { headers: { "x-api-key": key }, next: { revalidate: 300 } });
    if (!r.ok) throw new Error(`neynar ${r.status}`);
    return r.json();
  };

  try {
    if (op === "user") {
      const username = (url.searchParams.get("username") || "").toLowerCase().replace(/^@/, "");
      if (!username) return Response.json({ error: "username required" }, { status: 400 });
      const d = await call(`/user/by_username?username=${encodeURIComponent(username)}`);
      return Response.json({ user: d?.user ? normUser(d.user) : null }, { headers: cache });
    }
    if (op === "search") {
      const q = (url.searchParams.get("q") || "").trim();
      if (q.length < 2) return Response.json({ users: [] }, { headers: cache });
      const d = await call(`/user/search?q=${encodeURIComponent(q)}&limit=8`);
      return Response.json({ users: (d?.result?.users ?? []).map(normUser) }, { headers: cache });
    }
    if (op === "byAddress") {
      const addrs = (url.searchParams.get("address") || "")
        .split(",")
        .map((a) => a.trim().toLowerCase())
        .filter((a) => isAddress(a));
      if (!addrs.length) return Response.json({ users: {} }, { headers: cache });
      const d = await call(`/user/bulk-by-address?addresses=${addrs.join(",")}`);
      const users: Record<string, FcUser> = {};
      for (const [addr, list] of Object.entries(d ?? {})) {
        const arr = list as NeynarUser[];
        if (Array.isArray(arr) && arr[0]) users[addr.toLowerCase()] = normUser(arr[0]);
      }
      return Response.json({ users }, { headers: cache });
    }
    if (op === "casts") {
      const fid = Number(url.searchParams.get("fid"));
      const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 25);
      if (!fid) return Response.json({ error: "fid required" }, { status: 400 });
      const d = await call(`/feed/user/casts?fid=${fid}&limit=${limit}&include_replies=false`);
      return Response.json({ casts: (d?.casts ?? []).map(normCast) }, { headers: cache });
    }
    return Response.json({ error: "unknown op" }, { status: 400 });
  } catch {
    return Response.json({ error: "Couldn't reach Farcaster" }, { status: 502 });
  }
}
