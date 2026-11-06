"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useBacking, usePeopleMap, usePosts, usePostsByCreators, useProfile } from "@/lib/hooks";
import { NetBanner } from "@/components/NetBanner";
import { PostCard } from "@/components/PostCard";
import { Composer } from "@/components/Composer";
import { FarcasterFeed } from "@/components/FarcasterFeed";
import { Skeleton } from "@/components/ui";

type Tab = "all" | "backing" | "fc";

export default function FeedPage() {
  const { address } = useAccount();
  const { data: me } = useProfile(address);
  const [tab, setTab] = useState<Tab>("all");
  const [limit, setLimit] = useState(30);
  const { data: posts, isLoading: allLoading } = usePosts(limit);
  const people = usePeopleMap();
  const { rows } = useBacking(address);
  const creators = useMemo(() => (rows ?? []).map((r) => r.creator), [rows]);
  const backing = useMemo(() => new Set(creators.map((c) => c.toLowerCase())), [creators]);
  const { data: backedPosts, isLoading: backedLoading } = usePostsByCreators(creators, tab === "backing");
  const shown = tab === "all" ? posts ?? [] : backedPosts ?? [];
  const isLoading = tab === "all" ? allLoading : backedLoading;

  return (
    <div className="flex flex-col gap-4">
      <NetBanner />
      {address &&
        (me ? (
          <Composer />
        ) : (
          <div className="surface flex flex-col items-start gap-3 p-5">
            <div>
              <div className="text-[17px] font-medium">Welcome, set up your profile</div>
              <p className="mt-1 text-[14px] text-fg-2">
                Create a profile to post, link your Farcaster and start getting backed. It takes a few seconds, and we&apos;ll fill in what we can from your Farcaster.
              </p>
            </div>
            <Link href="/profile/edit" className="btn btn-primary">
              Create your profile
            </Link>
          </div>
        ))}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[22px] font-medium">Feed</h1>
        <div className="seg flex w-full sm:w-auto" role="group" aria-label="Show">
          <button className="flex-1 whitespace-nowrap sm:flex-none" aria-pressed={tab === "all"} onClick={() => setTab("all")}>
            Everyone
          </button>
          <button className="flex-1 whitespace-nowrap sm:flex-none" aria-pressed={tab === "backing"} onClick={() => setTab("backing")}>
            People I back
          </button>
          <button className="flex-1 whitespace-nowrap sm:flex-none" aria-pressed={tab === "fc"} onClick={() => setTab("fc")}>
            On Farcaster
          </button>
        </div>
      </div>
      {tab === "fc" ? (
        <FarcasterFeed />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : shown.length === 0 ? (
        <div className="surface px-6 py-12 text-center">
          <div className="text-[18px] font-medium">
            {tab === "backing" ? (creators.length === 0 ? "Back someone to see their posts here" : "No posts yet from people you back") : "No posts yet"}
          </div>
          <p className="mt-2 text-fg-2">
            {tab === "backing" ? (
              creators.length === 0 ? (
                <Link className="text-lamp hover:underline" href="/search">
                  Find people to back
                </Link>
              ) : (
                "Their posts will show up here as soon as they post"
              )
            ) : (
              "Be the first to post"
            )}
          </p>
        </div>
      ) : (
        <>
          {shown.map((p) => (
            <PostCard key={p.id.toString()} p={p} people={people} backing={backing} />
          ))}
          {tab === "all" && posts && posts.length >= limit && (
            <button className="btn btn-quiet btn-sm self-center" onClick={() => setLimit((l) => l + 30)}>
              Show older posts
            </button>
          )}
        </>
      )}
    </div>
  );
}
