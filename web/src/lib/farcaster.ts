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
