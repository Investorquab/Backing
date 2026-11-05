"use client";
import { useQuery } from "@tanstack/react-query";
import type { CreatorView } from "./hooks";

/** Is this creator's X account linked? Checked by our server against their public X post. */
export function useXVerified(c?: Pick<CreatorView, "creator" | "x" | "xPost">) {
  const q = useQuery({
    queryKey: ["xverify", c?.creator, c?.x, c?.xPost],
    enabled: !!c?.x && !!c?.xPost,
    staleTime: 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const r = await fetch(`/api/x/verify?address=${c!.creator}&x=${encodeURIComponent(c!.x)}&post=${c!.xPost}`);
      return (await r.json()) as { verified: boolean; reason?: string };
    },
  });
  return q.data?.verified === true;
}

export type XPostData = { handle: string; name: string; text: string; date: string; url: string };

export function useXPost(url?: string) {
  return useQuery({
    queryKey: ["xpost", url],
    enabled: !!url,
    staleTime: 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const r = await fetch(`/api/x/post?url=${encodeURIComponent(url!)}`);
      if (!r.ok) throw new Error("unavailable");
      return (await r.json()) as XPostData;
    },
  });
}
