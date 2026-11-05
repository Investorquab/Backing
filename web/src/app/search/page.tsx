"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { useApr, usePeople, type ProfileView } from "@/lib/hooks";
import { money, num } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { Skeleton } from "@/components/ui";

type Sort = "backing" | "earned" | "new";

export default function Search() {
  const { data, isLoading } = usePeople();
  const { incomeApr } = useApr();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("backing");
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("q");
    if (fromUrl) setQ(fromUrl);
  }, []);

  const term = q.trim().toLowerCase().replace(/^@/, "");
  const list = useMemo(() => {
    const key = (p: ProfileView) => (sort === "backing" ? p.principal : sort === "earned" ? p.totalEarned : p.joinedAt);
    return (data ?? [])
      .filter((p) => !term || p.profile.username.includes(term) || p.profile.baseName.toLowerCase().includes(term) || p.account.toLowerCase().startsWith(term))
      .sort((a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0));
  }, [data, term, sort]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[22px] font-medium">Search</h1>
      <label className="relative">
        <SearchIcon size={18} strokeWidth={1.5} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input h-12 rounded-full bg-card pl-11 text-[16px]" placeholder="Username, Base name or wallet" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" autoFocus />
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
      {isLoading ? (
        <Skeleton className="h-72" />
      ) : list.length === 0 ? (
        <div className="surface px-6 py-12 text-center text-fg-2">{term ? `No one matches "${q}"` : "No one here yet"}</div>
      ) : (
        <ol className="surface divide-line overflow-hidden">
          {list.map((p, i) => (
            <li key={p.account}>
              <Link href={`/u/${p.profile.username}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised/60">
                <span className={`num w-6 text-[13px] ${i < 3 && !term && sort === "backing" ? "text-lamp" : "text-muted"}`}>{i + 1}</span>
                <Avatar address={p.account} src={p.profile.avatar} name={p.profile.username} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">@{p.profile.username}</div>
                  <div className="truncate text-[13px] text-muted">
                    {p.profile.baseName ? `${p.profile.baseName} · ` : ""}
                    {Number(p.backerCount)} backer{Number(p.backerCount) === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-[15px]">{money(num(p.principal))}</div>
                  <div className="num text-[12px] text-muted">{money((num(p.principal) * incomeApr) / 12)} a month</div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
