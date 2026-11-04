"use client";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowUpRight, MessageSquareQuote } from "lucide-react";
import { Kind, type Activity, type CreatorView } from "@/lib/hooks";
import { ago, money, num, short } from "@/lib/format";
import { useMiniApp } from "@/lib/miniapp";
import { Avatar } from "./Avatar";
import { WindowMark } from "./WindowMark";

function Who({ address, creators }: { address: string; creators: Map<string, CreatorView> }) {
  const c = creators.get(address.toLowerCase());
  if (c)
    return (
      <Link href={`/c/${c.creator}`} className="font-medium text-fg hover:underline">
        {c.name}
      </Link>
    );
  return <span className="num text-[14px] text-fg">{short(address)}</span>;
}

export function FeedItem({ a, creators, compact = false }: { a: Activity; creators: Map<string, CreatorView>; compact?: boolean }) {
  const { address } = useAccount();
  const mini = useMiniApp();
  const creator = creators.get(a.creator.toLowerCase());
  const name = creator?.name ?? short(a.creator);
  const isMe = address?.toLowerCase() === a.creator.toLowerCase();
  const hasCast = a.cast && !/^0x0+$/.test(a.cast);

  const time = <span className="num text-[12px] text-muted">{ago(a.time)}</span>;
  const backBtn =
    !isMe && creator ? (
      <Link href={`/c/${a.creator}#back`} className="btn btn-secondary btn-sm">
        Back {name}
      </Link>
    ) : null;

  if (a.kind === Kind.Posted) {
    let host = "";
    try {
      host = a.link ? new URL(a.link).hostname.replace(/^www\./, "") : "";
    } catch {}
    return (
      <article className="flex gap-3 px-4 py-4">
        {!compact && (
          <Link href={`/c/${a.creator}`} className="shrink-0">
            <Avatar address={a.creator} src={creator?.avatar} name={name} size={40} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <Who address={a.creator} creators={creators} />
            {creator?.handle && <span className="truncate text-[13px] text-muted">@{creator.handle}</span>}
            <span className="ml-auto">{time}</span>
          </div>
          <p className="mt-1 whitespace-pre-line break-words text-[15px] text-fg">{a.text}</p>
          {host && /^https:\/\//.test(a.link) && (
            <a href={a.link} target="_blank" rel="noreferrer nofollow" className="mt-2 inline-flex items-center gap-1 text-[14px] text-fg-2 hover:text-fg">
              {host} <ArrowUpRight size={14} strokeWidth={1.5} />
            </a>
          )}
          {!compact && backBtn && <div className="mt-3">{backBtn}</div>}
        </div>
      </article>
    );
  }

  let line: React.ReactNode = null;
  let icon: React.ReactNode = <Avatar address={a.actor} src={creators.get(a.actor.toLowerCase())?.avatar} name={creators.get(a.actor.toLowerCase())?.name} size={28} />;
  if (a.kind === Kind.Backed)
    line = (
      <>
        <Who address={a.actor} creators={creators} /> backed <Who address={a.creator} creators={creators} /> with <span className="num text-fg">{money(num(a.amount))}</span>
      </>
    );
  if (a.kind === Kind.Joined)
    line = (
      <>
        <Who address={a.creator} creators={creators} /> started taking backers
      </>
    );
  if (a.kind === Kind.Claimed)
    line = (
      <>
        <Who address={a.creator} creators={creators} /> claimed <span className="num text-fg">{money(num(a.amount))}</span> of yield from backers
      </>
    );
  if (a.kind === Kind.Milestone) {
    icon = (
      <span className="flex h-7 w-7 items-center justify-center">
        <WindowMark size={18} />
      </span>
    );
    line = (
      <>
        <Who address={a.creator} creators={creators} /> passed <span className="num text-fg">{money(num(a.amount))}</span> in backing
      </>
    );
  }

  return (
    <article className="flex gap-3 px-4 py-3">
      <div className="shrink-0 pt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 text-[14px] text-fg-2">{line}</p>
          {time}
        </div>
        {a.kind === Kind.Backed && a.text && <p className="mt-2 border-l-2 border-[var(--line-2)] pl-3 text-[15px] text-fg">{a.text}</p>}
        {hasCast && (
          <button
            className="mt-2 inline-flex items-center gap-1 text-[13px] text-fg-2 hover:text-fg disabled:hover:text-fg-2"
            onClick={() => mini.viewCast(a.cast, creator?.handle || undefined)}
            disabled={!mini.inMiniApp}
            title={mini.inMiniApp ? "Open the cast" : "Open in Base App to view the cast"}
          >
            <MessageSquareQuote size={14} strokeWidth={1.5} /> From a cast <span className="num text-muted">{a.cast.slice(0, 10)}…</span>
          </button>
        )}
      </div>
    </article>
  );
}
