"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useApr, useCreators, type CreatorView } from "@/lib/hooks";
import { money, num } from "@/lib/format";
import { cleanHandle, xIntent } from "@/lib/x";
import { useXVerified } from "@/lib/xhooks";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/Shell";
import { Verified, XGlyph } from "@/components/XBits";
import { Skeleton } from "@/components/ui";

type Sort = "backing" | "earned" | "new";

export default function Discover() {
  const { data: creators, isLoading } = useCreators();
  const { incomeApr } = useApr();
  const [sort, setSort] = useState<Sort>("backing");
  const [q, setQ] = useState("");
  const [site, setSite] = useState("");
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("q");
    if (fromUrl) setQ(fromUrl);
    setSite(window.location.origin);
  }, []);

  const term = q.trim().toLowerCase().replace(/^@/, "");
  const list = useMemo(() => {
    const key = (c: CreatorView) => (sort === "backing" ? c.principal : sort === "earned" ? c.totalEarned : c.registeredAt);
    return (creators ?? [])
      .filter(
        (c) =>
          !term ||
          c.name.toLowerCase().includes(term) ||
          c.x.toLowerCase().includes(term) ||
          c.handle.toLowerCase().includes(term) ||
          c.creator.toLowerCase().startsWith(term),
      )
      .sort((a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0));
  }, [creators, sort, term]);

  const handle = cleanHandle(q);
  const exact = (creators ?? []).some((c) => c.x.toLowerCase() === handle.toLowerCase());
  const showInvite = handle.length >= 2 && !exact && !term.startsWith("0x");

  return (
    <>
      <PageHeader title="Discover">
        <div className="flex flex-col gap-3 px-4 pb-3">
          <label className="relative">
            <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input h-11 rounded-full bg-card pl-10"
              placeholder="Search name or @X username"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search creators by name or X username"
              autoFocus
            />
          </label>
          <div className="seg self-start" role="group" aria-label="Sort">
            {(
              [
                ["backing", "Most backed"],
                ["earned", "Top earning"],
                ["new", "Newest"],
              ] as [Sort, string][]
            ).map(([k, l]) => (
              <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      {showInvite && (
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-raised text-fg-2">
            <XGlyph size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium">@{handle} isn&apos;t on Backing yet</div>
            <div className="text-[13px] text-fg-2">Invite them. Once they join, you can back them here</div>
          </div>
          <a
            className="btn btn-primary btn-sm"
            target="_blank"
            rel="noreferrer"
            href={xIntent(`@${handle} I want to back you on Backing. My USDC stays mine and its yield goes to you, every week. Set up your profile here`, site)}
          >
            Invite on X
          </a>
        </div>
      )}

      {isLoading ? (
        <div className="p-4">
          <Skeleton className="h-72" />
        </div>
      ) : list.length === 0 ? (
        !showInvite && (
          <p className="px-8 py-16 text-center text-fg-2">
            {term ? "No one matches that yet" : "No creators yet."}{" "}
            <Link className="text-lamp hover:underline" href="/creator">
              Be the first
            </Link>
          </p>
        )
      ) : (
        <ol>
          {list.map((c, i) => (
            <Row key={c.creator} c={c} rank={i + 1} highlight={i < 3 && !term} incomeApr={incomeApr} />
          ))}
        </ol>
      )}
    </>
  );
}

function Row({ c, rank, highlight, incomeApr }: { c: CreatorView; rank: number; highlight: boolean; incomeApr: number }) {
  const verified = useXVerified(c);
  return (
    <li>
      <Link href={`/c/${c.creator}`} className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3 transition-colors hover:bg-raised/40">
        <span className={`num w-6 text-[13px] ${highlight ? "text-lamp" : "text-muted"}`}>{rank}</span>
        <Avatar address={c.creator} src={c.avatar} name={c.name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate font-medium">{c.name}</span>
            {verified && <Verified />}
          </div>
          <div className="truncate text-[13px] text-muted">
            {c.x ? `@${c.x} · ` : ""}
            {Number(c.backerCount)} backer{Number(c.backerCount) === 1 ? "" : "s"}
          </div>
          {c.bio && <div className="mt-0.5 line-clamp-1 text-[14px] text-fg-2">{c.bio}</div>}
        </div>
        <div className="text-right">
          <div className="num text-[15px]">{money(num(c.principal))}</div>
          <div className="num text-[12px] text-muted">{money((num(c.principal) * incomeApr) / 12)} a month</div>
        </div>
      </Link>
    </li>
  );
}
