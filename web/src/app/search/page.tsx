"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, Users } from "lucide-react";
import { useApr, usePeople, type ProfileView } from "@/lib/hooks";
import { useFarcasterSearch } from "@/lib/farcaster";
import { money, num } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { FcAvatar } from "@/components/FcAvatar";
import { Skeleton } from "@/components/ui";

type Mode = "farcaster" | "backing";
type Sort = "backing" | "earned" | "new";

export default function Search() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode>("farcaster");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("q");
    if (fromUrl) setQ(fromUrl);
    if (params.get("on") === "backing") setMode("backing");
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[22px] font-medium">Find creators</h1>
      <label className="relative">
        <SearchIcon size={18} strokeWidth={1.5} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input h-12 rounded-full bg-card pl-11 text-[16px]"
          placeholder={mode === "farcaster" ? "Search Farcaster by username" : "Username, Base name or wallet"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search creators"
          autoFocus
        />
      </label>
      <div className="seg self-start" role="group" aria-label="Where to search">
        <button aria-pressed={mode === "farcaster"} onClick={() => setMode("farcaster")}>
          On Farcaster
        </button>
        <button aria-pressed={mode === "backing"} onClick={() => setMode("backing")}>
          On Backing
        </button>
      </div>
      {mode === "farcaster" ? <FarcasterResults q={q} /> : <BackingResults q={q} />}
    </div>
  );
}

/** Live Farcaster user search. Each result opens the creator page, where you back them or invite them. */
function FarcasterResults({ q }: { q: string }) {
  const { data, isLoading, isError } = useFarcasterSearch(q);
  const term = q.trim();
  if (term.length < 2)
    return (
      <div className="surface px-6 py-12 text-center text-fg-2">
        Type a Farcaster handle to find anyone — then back them, or invite them to Backing if they&apos;re not here yet
      </div>
    );
  if (isLoading) return <Skeleton className="h-64" />;
  if (isError) return <div className="surface px-6 py-10 text-center text-fg-2">Couldn&apos;t reach Farcaster right now. Try again in a moment</div>;
  if (!data || data.length === 0) return <div className="surface px-6 py-12 text-center text-fg-2">No one on Farcaster matches &ldquo;{term}&rdquo;</div>;
  return (
    <ol className="surface divide-line overflow-hidden">
      {data.map((u) => (
        <li key={u.fid}>
          <Link href={`/fc/${u.username}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised/60">
            <FcAvatar pfp={u.pfp} name={u.username} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{u.displayName}</div>
              <div className="truncate text-[13px] text-muted">@{u.username}</div>
            </div>
            <div className="num inline-flex items-center gap-1 text-[13px] text-muted">
              <Users size={13} strokeWidth={1.5} /> {u.followerCount.toLocaleString()}
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** People already on Backing, rankable. */
function BackingResults({ q }: { q: string }) {
  const { data, isLoading } = usePeople();
  const { incomeApr } = useApr();
  const [sort, setSort] = useState<Sort>("backing");
  const term = q.trim().toLowerCase().replace(/^@/, "");
  const list = useMemo(() => {
    const key = (p: ProfileView) => (sort === "backing" ? p.principal : sort === "earned" ? p.totalEarned : p.joinedAt);
    return (data ?? [])
      .filter((p) => !term || p.profile.username.includes(term) || p.profile.baseName.toLowerCase().includes(term) || p.account.toLowerCase().startsWith(term))
      .sort((a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0));
  }, [data, term, sort]);

  return (
    <div className="flex flex-col gap-4">
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
        <div className="surface px-6 py-12 text-center text-fg-2">{term ? `No one on Backing matches "${q}"` : "No one here yet"}</div>
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
