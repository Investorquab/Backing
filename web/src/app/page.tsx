"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApr, useCreators, useStats, type CreatorView } from "@/lib/hooks";
import { compact, num, usd } from "@/lib/format";
import { useNet } from "@/lib/net";
import { Avatar } from "@/components/Avatar";
import { Empty, LiveNumber, Skeleton, Stat } from "@/components/ui";

const YEAR = 365 * 24 * 3600;
type Sort = "backing" | "earned" | "new";

export default function Home() {
  const { net } = useNet();
  const { apr, estimated, incomeApr, demo } = useApr();
  const { stats, dataUpdatedAt } = useStats();
  const { data: creators, isLoading } = useCreators();
  const [sort, setSort] = useState<Sort>("backing");

  const sorted = useMemo(() => {
    if (!creators) return [];
    const key = (c: CreatorView) =>
      sort === "backing" ? c.principal : sort === "earned" ? c.totalEarned : c.registeredAt;
    return [...creators].sort((a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0));
  }, [creators, sort]);

  const tvl = num(stats?.principal);

  return (
    <div className="flex flex-col gap-10">
      <section className="pt-4 sm:pt-10">
        <p className="mb-3 text-sm font-medium text-lamp">Patronage that doesn&apos;t disappear</p>
        <h1 className="glow max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Your capital works the night shift.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted sm:text-lg">
          Back a creator with USDC instead of tipping. It sits in a yield vault on Base: the yield goes to them, the
          principal stays yours, and you can take it back any time.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="#creators" className="btn btn-lamp">
            Find someone to back
          </a>
          <Link href="/creator" className="btn btn-ghost">
            I&apos;m a creator
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["1", "Stake, don't spend", "Deposit USDC behind a creator. It goes into an ERC-4626 vault on Base."],
          ["2", "Yield works for them", "While you sleep, your capital's yield builds up for the creator, who claims it each epoch."],
          ["3", "Leave whenever", "Withdraw your full principal any time. Their income stops; your money never left you."],
        ].map(([n, t, d]) => (
          <div key={n} className="card p-5">
            <div className="num mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-lamp/15 text-sm text-lamp">{n}</div>
            <div className="font-semibold">{t}</div>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total backing">
          <span className="num">${compact(tvl)}</span>
        </Stat>
        <Stat label="Creators">
          <span className="num">{stats ? Number(stats.creators) : "–"}</span>
        </Stat>
        <Stat label="Yield to creators" hint="all time, live">
          <LiveNumber value={num(stats?.distributed)} perSecond={(tvl * apr) / YEAR} at={dataUpdatedAt} />
        </Stat>
        <Stat label="Vault APR" hint={demo ? "sped up for the demo" : estimated ? "estimate" : net.vaultName}>
          <span className="num">{(apr * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</span>
        </Stat>
      </section>

      <section id="creators" className="scroll-mt-24">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Leaderboard</h2>
          <div className="flex gap-1 rounded-full border border-line bg-panel p-1 text-sm">
            {(
              [
                ["backing", "Most backed"],
                ["earned", "Top earning"],
                ["new", "Newest"],
              ] as [Sort, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`rounded-full px-3 py-1.5 ${sort === k ? "bg-panel-2 text-fg" : "text-muted"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : sorted.length === 0 ? (
          <Empty title="No creators yet">
            Be the first. <Link className="text-lamp underline" href="/creator">Create a profile</Link> and share your link.
          </Empty>
        ) : (
          <ol className="flex flex-col gap-2">
            {sorted.map((c, i) => (
              <CreatorRow key={c.creator} c={c} rank={i + 1} apr={incomeApr} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function CreatorRow({ c, rank, apr }: { c: CreatorView; rank: number; apr: number }) {
  const p = num(c.principal);
  return (
    <li>
      <Link href={`/c/${c.creator}`} className="card flex items-center gap-3 p-3 transition hover:border-[#3a3f6a] sm:gap-4 sm:p-4">
        <span className={`num w-6 text-center text-sm ${rank <= 3 ? "text-lamp" : "text-dim"}`}>{rank}</span>
        <Avatar address={c.creator} src={c.avatar} name={c.name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{c.name}</div>
          <div className="truncate text-xs text-dim">
            {c.handle ? `@${c.handle} · ` : ""}
            {Number(c.backerCount)} backer{Number(c.backerCount) === 1 ? "" : "s"}
          </div>
        </div>
        <div className="text-right">
          <div className="num font-semibold">${compact(p)}</div>
          <div className="num text-xs text-ok">~${usd((p * apr) / 12)}/mo</div>
        </div>
      </Link>
    </li>
  );
}
