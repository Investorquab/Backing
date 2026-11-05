"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useApr, useCreatorMap, usePositions, usePosts, useStats } from "@/lib/hooks";
import { money, num } from "@/lib/format";
import { PageHeader, Tabs } from "@/components/Shell";
import { NetBanner } from "@/components/NetBanner";
import { PostCard } from "@/components/PostCard";
import { Composer } from "@/components/Composer";
import { SignIn } from "@/components/SignIn";
import { LiveNumber, Skeleton } from "@/components/ui";
import { WindowMark } from "@/components/WindowMark";

type Tab = "everyone" | "following";
const YEAR = 365 * 24 * 3600;

export default function Home() {
  const { address, status } = useAccount();
  const [tab, setTab] = useState<Tab>("everyone");
  const [limit, setLimit] = useState(40);
  const { data: posts, isLoading } = usePosts(limit);
  const creators = useCreatorMap();
  const { data: positions } = usePositions(address);

  const backing = useMemo(() => new Set((positions ?? []).filter((p) => p.principal > 0n).map((p) => p.creator.toLowerCase())), [positions]);
  const following = useMemo(() => {
    const s = new Set(backing);
    if (address) s.add(address.toLowerCase());
    return s;
  }, [backing, address]);
  const shown = useMemo(() => (tab === "everyone" ? posts ?? [] : (posts ?? []).filter((p) => following.has(p.creator.toLowerCase()))), [posts, tab, following]);

  return (
    <>
      <PageHeader title="Home">
        <Tabs<Tab>
          tabs={[
            ["everyone", "Everyone"],
            ["following", "Following"],
          ]}
          value={tab}
          onChange={setTab}
        />
      </PageHeader>
      <NetBanner />
      {status === "disconnected" && <Intro />}
      {address && creators.has(address.toLowerCase()) && (
        <div className="hidden border-b border-[var(--line)] px-4 py-3 sm:block">
          <Composer />
        </div>
      )}
      {isLoading ? (
        <div className="p-4">
          <Skeleton className="h-64" />
        </div>
      ) : shown.length === 0 ? (
        <div className="px-8 py-16 text-center">
          <div className="text-[20px] font-medium">{tab === "following" ? "Back someone to fill this tab" : "No posts yet"}</div>
          <p className="mx-auto mt-2 max-w-sm text-fg-2">
            {tab === "following" ? (
              <>
                Posts from the creators you back show here.{" "}
                <Link className="text-lamp underline-offset-2 hover:underline" href="/discover">
                  Find someone to back
                </Link>
              </>
            ) : (
              "When creators post, it shows up here"
            )}
          </p>
        </div>
      ) : (
        <>
          {shown.map((p) => (
            <PostCard key={p.id.toString()} p={p} creators={creators} backing={backing} />
          ))}
          {posts && posts.length >= limit && (
            <div className="flex justify-center py-6">
              <button className="btn btn-quiet btn-sm" onClick={() => setLimit((l) => l + 40)}>
                Show older posts
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

/** What signed-out visitors see above the feed. */
function Intro() {
  const { stats, dataUpdatedAt } = useStats();
  const { apr } = useApr();
  const tvl = num(stats?.principal);
  return (
    <section className="border-b border-[var(--line)] px-4 py-8 sm:px-6">
      <h2 className="text-[32px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-[40px]">Back creators with money you keep</h2>
      <p className="mt-3 max-w-[34rem] text-[16px] leading-[1.55] text-fg-2">
        Stake USDC behind someone you believe in. It earns yield on Base, the yield goes to them, and you can take every cent back
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <SignIn big />
        <Link href="/creator" className="btn btn-secondary btn-lg">
          Start as a creator
        </Link>
      </div>
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-fg-2">
        <span>
          <span className="num text-fg">{money(tvl)}</span> backing creators
        </span>
        <span className="flex items-center gap-1.5">
          <WindowMark size={12} />
          <LiveNumber className="text-fg" value={num(stats?.distributed)} perSecond={(tvl * apr) / YEAR} at={dataUpdatedAt} /> sent to creators
        </span>
      </div>
    </section>
  );
}
