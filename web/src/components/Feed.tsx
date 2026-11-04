"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Kind, useActivity, useApr, useCreatorMap, useCreators, usePositions } from "@/lib/hooks";
import { money, num } from "@/lib/format";
import { Avatar } from "./Avatar";
import { FeedItem } from "./FeedItem";
import { Empty, Skeleton } from "./ui";

type Tab = "following" | "everyone";

export function Feed() {
  const { address } = useAccount();
  const [tab, setTab] = useState<Tab>("following");
  const [limit, setLimit] = useState(60);
  const { data: items, isLoading } = useActivity(limit);
  const creators = useCreatorMap();
  const { data: positions } = usePositions(address);

  const following = useMemo(() => {
    const s = new Set((positions ?? []).map((p) => p.creator.toLowerCase()));
    if (address) s.add(address.toLowerCase());
    return s;
  }, [positions, address]);

  const shown = useMemo(() => {
    if (!items) return [];
    if (tab === "everyone") return items;
    return items.filter((a) => following.has(a.creator.toLowerCase()) || (a.kind === Kind.Backed && following.has(a.actor.toLowerCase())));
  }, [items, tab, following]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-[28px] font-medium tracking-[-0.01em]">Feed</h1>
          <div className="seg" role="group" aria-label="Feed">
            <button aria-pressed={tab === "following"} onClick={() => setTab("following")}>
              Following
            </button>
            <button aria-pressed={tab === "everyone"} onClick={() => setTab("everyone")}>
              Everyone
            </button>
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : shown.length === 0 ? (
          tab === "following" ? (
            <Empty title="Your feed fills up as you back people">
              Updates from the creators you back show here.{" "}
              <button className="text-lamp underline underline-offset-2" onClick={() => setTab("everyone")}>
                See everyone
              </button>{" "}
              or{" "}
              <Link className="text-lamp underline underline-offset-2" href="/discover">
                find someone to back
              </Link>
            </Empty>
          ) : (
            <Empty title="Nothing here yet">The first creator to join shows up here</Empty>
          )
        ) : (
          <>
            <div className="surface divide-line overflow-hidden">
              {shown.map((a) => (
                <FeedItem key={a.id.toString()} a={a} creators={creators} />
              ))}
            </div>
            {items && items.length >= limit && (
              <div className="mt-4 flex justify-center">
                <button className="btn btn-quiet btn-sm" onClick={() => setLimit((l) => l + 60)}>
                  Show older
                </button>
              </div>
            )}
          </>
        )}
      </section>
      <aside className="hidden lg:block">
        <Suggested exclude={following} />
      </aside>
    </div>
  );
}

function Suggested({ exclude }: { exclude: Set<string> }) {
  const { data } = useCreators();
  const { incomeApr } = useApr();
  const list = (data ?? [])
    .filter((c) => !exclude.has(c.creator.toLowerCase()))
    .sort((a, b) => (b.principal > a.principal ? 1 : -1))
    .slice(0, 5);
  if (!list.length) return null;
  return (
    <div className="sticky top-20">
      <h2 className="mb-3 text-[15px] font-medium">Creators to back</h2>
      <ul className="surface divide-line">
        {list.map((c) => (
          <li key={c.creator}>
            <Link href={`/c/${c.creator}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/50">
              <Avatar address={c.creator} src={c.avatar} name={c.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{c.name}</div>
                <div className="num text-[12px] text-muted">{money((num(c.principal) * incomeApr) / 12)} a month</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/discover" className="mt-3 inline-block text-[14px] text-fg-2 hover:text-fg">
        See all creators
      </Link>
    </div>
  );
}
