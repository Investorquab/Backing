"use client";
import { useQuery } from "@tanstack/react-query";

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

async function get<T>(params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`/api/farcaster?${qs}`);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/** The Farcaster account that has verified `address`, if any. Trustless — the account can't be faked. */
export function useFarcaster(address?: string) {
  const a = address?.toLowerCase();
  return useQuery({
    queryKey: ["fc", "addr", a],
    enabled: !!a,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => (await get<{ users: Record<string, FcUser> }>({ op: "byAddress", address: a! })).users[a!] ?? null,
  });
}

/** Recent casts for a Farcaster id. */
export function useCasts(fid?: number, limit = 12) {
  return useQuery({
    queryKey: ["fc", "casts", fid, limit],
    enabled: !!fid,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => (await get<{ casts: FcCast[] }>({ op: "casts", fid: String(fid), limit: String(limit) })).casts,
  });
}

/** Type-ahead search over Farcaster usernames. */
export function useFarcasterSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ["fc", "search", query.toLowerCase()],
    enabled: query.length >= 2,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => (await get<{ users: FcUser[] }>({ op: "search", q: query })).users,
  });
}

/** Pull a Farcaster handle out of a profile link (farcaster.xyz/x, warpcast.com/x, or a bare @handle). */
export function farcasterHandleFromLink(link?: string): string | null {
  if (!link) return null;
  const s = link.trim();
  const m = s.match(/(?:farcaster\.xyz|warpcast\.com)\/(?:@)?([a-z0-9_.-]+)/i);
  if (m) return m[1].toLowerCase().replace(/\.$/, "");
  return null;
}

/**
 * A Backing creator's Farcaster account, resolved two ways:
 *  - verified: their Backing wallet is a verified address on the account (trustless, gets the badge)
 *  - linked: they typed their handle into their profile (self-declared, no badge)
 */
export function useProfileFarcaster(address?: string, link?: string) {
  const byAddr = useFarcaster(address);
  const handle = farcasterHandleFromLink(link);
  const byHandle = useFarcasterUser(byAddr.data ? undefined : handle ?? undefined);
  if (byAddr.data) return { user: byAddr.data, verified: true, isLoading: false };
  if (byHandle.data) {
    const verified = !!address && byHandle.data.addresses.includes(address.toLowerCase());
    return { user: byHandle.data, verified, isLoading: false };
  }
  return { user: null, verified: false, isLoading: byAddr.isLoading || byHandle.isLoading };
}

/** One Farcaster user by exact username. */
export function useFarcasterUser(username?: string) {
  const u = username?.toLowerCase().replace(/^@/, "");
  return useQuery({
    queryKey: ["fc", "user", u],
    enabled: !!u,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => (await get<{ user: FcUser | null }>({ op: "user", username: u! })).user,
  });
}
