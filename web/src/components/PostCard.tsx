"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useAccount } from "wagmi";
import type { Activity, ProfileView } from "@/lib/hooks";
import { ago, short } from "@/lib/format";
import { safeImage } from "@/lib/images";
import { useUi } from "@/lib/ui-state";
import { Avatar } from "./Avatar";
import { WindowMark } from "./WindowMark";

/** A post: who, when, what. One action that matters: Back. */
export function PostCard({ p, people, backing }: { p: Activity; people: Map<string, ProfileView>; backing: Set<string> }) {
  const ui = useUi();
  const { address } = useAccount();
  const who = people.get(p.subject.toLowerCase());
  const name = who?.profile.username ?? short(p.subject);
  const img = safeImage(p.image);
  const isMe = address?.toLowerCase() === p.subject.toLowerCase();
  const iBack = backing.has(p.subject.toLowerCase());
  const href = who ? `/u/${who.profile.username}` : `/u/${p.subject}`;
  return (
    <article className="surface overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href={href}>
          <Avatar address={p.subject} src={who?.profile.avatar} name={name} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate text-[15px] font-medium hover:underline">
            @{name}
          </Link>
          <div className="truncate text-[13px] text-muted">
            {who?.profile.baseName ? `${who.profile.baseName} · ` : ""}
            {ago(p.time)}
          </div>
        </div>
        {!isMe && (
          <button className={`btn btn-sm ${iBack ? "btn-secondary" : "btn-primary"}`} onClick={() => ui.openBack({ creator: p.subject })}>
            {iBack && <WindowMark size={13} />}
            {iBack ? "Backing" : "Back"}
          </button>
        )}
      </div>
      {p.text && <p className="whitespace-pre-line break-words px-4 pt-3 text-[16px] leading-[1.5]">{p.text}</p>}
      {img && (
        <div className="mt-3 border-t border-[var(--line)] bg-raised">
          <img src={img} alt={`Picture in @${name}'s post`} loading="lazy" className="max-h-[560px] w-full object-cover" />
        </div>
      )}
      {!img && <div className="h-4" />}
    </article>
  );
}
