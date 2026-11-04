"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useApr, useCreators, type CreatorView } from "@/lib/hooks";
import { money, num } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { Empty, PageTitle, Skeleton } from "@/components/ui";

type Sort = "backing" | "earned" | "new";

export default function Discover() {
  const { data: creators, isLoading } = useCreators();
  const { incomeApr } = useApr();
  const [sort, setSort] = useState<Sort>("backing");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^@/, "");
    const key = (c: CreatorView) => (sort === "backing" ? c.principal : sort === "earned" ? c.totalEarned : c.registeredAt);
    return (creators ?? [])
      .filter((c) => !term || c.name.toLowerCase().includes(term) || c.handle.toLowerCase().includes(term) || c.creator.toLowerCase().startsWith(term))
      .sort((a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0));
  }, [creators, sort, q]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Discover" sub="Everyone taking backers on Backing" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search creators by name or username" autoFocus />
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
      {isLoading ? (
        <Skeleton className="h-72" />
      ) : list.length === 0 ? (
        <Empty title={q ? `No one called "${q}" yet` : "No creators yet"}>
          {q ? "Check the spelling, or search by wallet address" : <Link className="text-lamp underline underline-offset-2" href="/creator">Be the first</Link>}
        </Empty>
      ) : (
        <ol className="surface divide-line">
          {list.map((c, i) => (
            <li key={c.creator}>
              <Link href={`/c/${c.creator}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised/50">
                <span className={`num w-6 text-[13px] ${i < 3 && !q ? "text-lamp" : "text-muted"}`}>{i + 1}</span>
                <Avatar address={c.creator} src={c.avatar} name={c.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="truncate text-[13px] text-muted">
                    {c.handle ? `@${c.handle} · ` : ""}
                    {Number(c.backerCount)} backer{Number(c.backerCount) === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-[15px]">{money(num(c.principal))}</div>
                  <div className="num text-[12px] text-muted">{money((num(c.principal) * incomeApr) / 12)} a month</div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
