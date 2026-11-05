"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "wagmi";
import { ArrowUpRight, MessageCircle, Share } from "lucide-react";
import type { CreatorView, Post } from "@/lib/hooks";
import { ago, money, num, short } from "@/lib/format";
import { safeImage } from "@/lib/images";
import { parseXPost } from "@/lib/x";
import { useMiniApp } from "@/lib/miniapp";
import { useUi } from "@/lib/ui-state";
import { useXVerified } from "@/lib/xhooks";
import { Avatar } from "./Avatar";
import { WindowMark } from "./WindowMark";
import { Verified, XPostCard } from "./XBits";

export function AuthorLine({ c, address, time }: { c?: CreatorView; address: string; time?: number }) {
  const verified = useXVerified(c);
  return (
    <div className="flex min-w-0 items-center gap-1 text-[15px]">
      <Link href={`/c/${address}`} onClick={(e) => e.stopPropagation()} className="truncate font-medium hover:underline">
        {c?.name ?? short(address)}
      </Link>
      {verified && <Verified />}
      {(c?.x || c?.handle) && <span className="truncate text-muted">@{c.x || c.handle}</span>}
      {time !== undefined && (
        <>
          <span className="text-muted">·</span>
          <span className="shrink-0 text-muted">{ago(time)}</span>
        </>
      )}
    </div>
  );
}

export function PostBody({ p, big = false }: { p: Post; big?: boolean }) {
  const img = safeImage(p.image);
  const isX = !!parseXPost(p.link);
  let host = "";
  try {
    host = p.link && !isX ? new URL(p.link).hostname.replace(/^www\./, "") : "";
  } catch {}
  return (
    <>
      {p.text && <p className={`whitespace-pre-line break-words ${big ? "text-[19px] leading-[1.45]" : "text-[15px]"}`}>{p.text}</p>}
      {img && (
        <div className="mt-3 overflow-hidden rounded-[16px] border border-[var(--line)] bg-raised">
          <img src={img} alt="" loading="lazy" className="max-h-[520px] w-full object-cover" />
        </div>
      )}
      {isX && <XPostCard url={p.link} />}
      {host && /^https:\/\//.test(p.link) && (
        <a
          href={p.link}
          target="_blank"
          rel="noreferrer nofollow"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-flex items-center gap-1 rounded-[10px] border border-[var(--line)] px-3 py-2 text-[14px] text-fg-2 hover:text-fg"
        >
          {host} <ArrowUpRight size={14} strokeWidth={1.5} />
        </a>
      )}
    </>
  );
}

export function PostActions({ p, creator, iBack }: { p: Post; creator?: CreatorView; iBack: boolean }) {
  const ui = useUi();
  const mini = useMiniApp();
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);
  const isMe = address?.toLowerCase() === p.creator.toLowerCase();
  const url = typeof window !== "undefined" ? `${window.location.origin}/p/${p.id}` : "";

  async function share(e: React.MouseEvent) {
    e.stopPropagation();
    const text = `${creator?.name ?? "A creator"} on Backing`;
    if (mini.inMiniApp) return void mini.composeCast(p.text ? `"${p.text.slice(0, 120)}"` : text, url);
    if (navigator.share) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const btn = "group flex h-9 items-center gap-1.5 rounded-full px-2 text-[13px] text-muted transition-colors";
  return (
    <div className="-ml-2 mt-2 flex max-w-[420px] items-center justify-between">
      <Link href={`/p/${p.id}`} onClick={(e) => e.stopPropagation()} className={`${btn} hover:text-fg`} aria-label="Comments">
        <MessageCircle size={18} strokeWidth={1.5} />
        <span className="num">{p.stats.comments || ""}</span>
      </Link>
      <button
        className={`${btn} ${iBack ? "text-lamp" : "hover:text-lamp"} disabled:opacity-40`}
        disabled={isMe}
        onClick={(e) => {
          e.stopPropagation();
          ui.openBack({ creator: p.creator, post: p.id });
        }}
        aria-label={iBack ? "You back this creator. Add more" : "Back this creator"}
        title={isMe ? "You can't back yourself" : "Back them from this post"}
      >
        <WindowMark size={16} lit={iBack} />
        <span className="num">{p.stats.backed > 0n ? money(num(p.stats.backed)) : "Back"}</span>
      </button>
      <button className={`${btn} hover:text-fg`} onClick={share} aria-label="Share">
        <Share size={18} strokeWidth={1.5} />
        {copied && <span>Copied</span>}
      </button>
    </div>
  );
}

/** A post in a feed, like a post on X. "Back" stands where a like would. */
export function PostCard({ p, creators, backing }: { p: Post; creators: Map<string, CreatorView>; backing: Set<string> }) {
  const router = useRouter();
  const c = creators.get(p.creator.toLowerCase());
  return (
    <article
      className="flex cursor-pointer gap-3 border-b border-[var(--line)] px-4 py-3 transition-colors hover:bg-raised/25"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button")) return;
        router.push(`/p/${p.id}`);
      }}
    >
      <Link href={`/c/${p.creator}`} className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <Avatar address={p.creator} src={c?.avatar} name={c?.name} size={40} />
      </Link>
      <div className="min-w-0 flex-1">
        <AuthorLine c={c} address={p.creator} time={p.time} />
        <div className="mt-0.5">
          <PostBody p={p} />
        </div>
        <PostActions p={p} creator={c} iBack={backing.has(p.creator.toLowerCase())} />
      </div>
    </article>
  );
}
