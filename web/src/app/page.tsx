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

export default function Home() {
  const { status } = useAccount();
  // Anyone not actively connected (disconnected, connecting, reconnecting) sees the site, not the app.
  if (status === "connected") return <Feed />;
  return <Landing />;
}

function Feed() {
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

const STEPS: [string, string][] = [
  ["Stake", "Put USDC behind a creator you believe in"],
  ["They earn", "It earns yield on Base — the yield streams to them"],
  ["Withdraw", "Your money stays yours. Take it back any time"],
];

function Landing() {
  const { stats, dataUpdatedAt } = useStats();
  const { apr } = useApr();
  const tvl = num(stats?.principal);
  return (
    <div className="flex flex-col gap-4">
      <section className="surface overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex gap-1.5" aria-hidden>
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="h-7 w-5 rounded-[2px]"
                style={{ background: [2, 5, 6, 9, 12, 13, 16].includes(i) ? "var(--color-lamp)" : "var(--color-raised)" }}
              />
            ))}
          </div>
          <h1 className="text-[32px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-[40px]">Back the creators you follow — with money you keep</h1>
          <p className="mt-3 text-[16px] leading-[1.55] text-fg-2">
            Tips disappear and creator coins dump. On Backing you stake USDC behind someone you believe in: it earns yield on Base, the yield goes to them, and your money stays
            yours. Stop backing, take it back
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <SignIn big />
            <Link href="/search" className="btn btn-secondary btn-lg">
              Find creators
            </Link>
          </div>
          <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STEPS.map(([t, s], i) => (
              <li key={t} className="rounded-[12px] bg-raised p-4">
                <div className="flex items-center gap-2">
                  <span className="num text-[13px] text-muted">{i + 1}</span>
                  <span className="text-[14px] font-medium">{t}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-fg-2">{s}</p>
              </li>
            ))}
          </ol>
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

      <section className="surface p-6 sm:p-8">
        <h2 className="text-[20px] font-medium">Why backing, not tipping</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[12px] bg-raised p-4">
            <div className="text-[13px] text-muted">Tips</div>
            <p className="mt-1.5 text-[14px] text-fg-2">Sent once, sold, gone. Nothing left behind</p>
          </div>
          <div className="rounded-[12px] bg-raised p-4">
            <div className="text-[13px] text-muted">Creator coins</div>
            <p className="mt-1.5 text-[14px] text-fg-2">Pump, dump, and the trust goes with it</p>
          </div>
          <div className="rounded-[12px] border border-lamp/40 bg-raised p-4">
            <div className="text-[13px] text-lamp">Backing</div>
            <p className="mt-1.5 text-[14px] text-fg">Your money stays yours — only the yield supports them. Zero downside</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="surface p-6">
          <div className="text-[13px] text-lamp">For creators</div>
          <h3 className="mt-1 text-[17px] font-medium">Recurring income, no selling, no dumping</h3>
          <p className="mt-2 text-[14px] leading-[1.55] text-fg-2">
            Link your Farcaster and your posts show here. Fans back you, and you earn the yield on their stake every epoch — steady support instead of one-off tips.
          </p>
        </div>
        <div className="surface p-6">
          <div className="text-[13px] text-lamp">For backers</div>
          <h3 className="mt-1 text-[17px] font-medium">Support with zero downside</h3>
          <p className="mt-2 text-[14px] leading-[1.55] text-fg-2">
            Your principal never leaves your control — withdraw it in full any time. Only the yield it earns goes to the creator. You lose nothing to support someone.
          </p>
        </div>
      </section>

      <section className="surface p-6 sm:p-8">
        <h2 className="text-[20px] font-medium">Already on Farcaster?</h2>
        <p className="mt-2 text-[15px] leading-[1.55] text-fg-2">
          Search any Farcaster creator and their real posts show up here, tied to their wallet — no new account, no reposting. Back the ones you like, or invite the ones who
          aren&apos;t here yet
        </p>
        <Link href="/search" className="btn btn-primary mt-4">
          Search Farcaster creators
        </Link>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 px-2 py-6 text-[13px] text-muted">
        <span>Backing — built for Vibeathon 02 · Night shift</span>
        <span className="flex gap-4">
          <a className="hover:text-fg" href="https://blog.vibestarter.xyz/vibeathon-02" target="_blank" rel="noreferrer">
            Vibeathon
          </a>
          <a className="hover:text-fg" href="https://github.com/Investorquab/Backing" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </span>
      </footer>
    </div>
  );
}
