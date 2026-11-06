"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useBacking, usePeopleMap, usePosts, usePostsByCreators } from "@/lib/hooks";
import { NetBanner } from "@/components/NetBanner";
import { PostCard } from "@/components/PostCard";
import { Composer } from "@/components/Composer";
import { Skeleton } from "@/components/ui";

type Tab = "all" | "backing";

export default function FeedPage() {
  const { address } = useAccount();
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
      {address && <Composer />}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-[22px] font-medium">Feed</h1>
        <div className="seg" role="group" aria-label="Show">
          <button aria-pressed={tab === "all"} onClick={() => setTab("all")}>
            Everyone
          </button>
          <button aria-pressed={tab === "backing"} onClick={() => setTab("backing")}>
            People I back
          </button>
        </div>
      </div>
      {isLoading ? (
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
