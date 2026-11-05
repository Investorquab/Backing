"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useApr, useBacking, usePeopleMap, usePosts, usePostsByCreators, useStats } from "@/lib/hooks";
import { money, num } from "@/lib/format";
import { NetBanner } from "@/components/NetBanner";
import { PostCard } from "@/components/PostCard";
import { Composer } from "@/components/Composer";
import { SignIn } from "@/components/SignIn";
import { LiveNumber, Skeleton } from "@/components/ui";
import { WindowMark } from "@/components/WindowMark";

type Tab = "all" | "backing";
const YEAR = 365 * 24 * 3600;

export default function Feed() {
  const { address, status } = useAccount();
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
      {status === "disconnected" && <Intro />}
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

function Intro() {
  const { stats, dataUpdatedAt } = useStats();
  const { apr } = useApr();
  const tvl = num(stats?.principal);
  return (
    <section className="surface overflow-hidden">
      <div className="p-6 sm:p-8">
        <h1 className="text-[32px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-[40px]">Back creators with money you keep</h1>
        <p className="mt-3 text-[16px] leading-[1.55] text-fg-2">
          Tips disappear and creator coins dump. On Backing you stake USDC behind someone you believe in: it earns yield on Base, the yield goes to them, and your money stays
          yours. Stop backing, take it back
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <SignIn big />
          <Link href="/search" className="btn btn-secondary btn-lg">
            See creators
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-[var(--line)] px-6 py-4 text-[14px] text-fg-2 sm:px-8">
        <span>
          <span className="num text-fg">{stats ? money(tvl) : "—"}</span> backing creators
        </span>
        <span className="flex items-center gap-1.5">
          <WindowMark size={12} />
          {stats ? (
            <LiveNumber className="text-fg" value={num(stats.distributed)} perSecond={(tvl * apr) / YEAR} at={dataUpdatedAt} />
          ) : (
            <span className="num text-fg">—</span>
          )}{" "}
          earned by creators
        </span>
      </div>
    </section>
  );
}
