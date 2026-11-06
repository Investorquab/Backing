"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { useFarcasterFeed, type FcFeedCast } from "@/lib/farcaster";
import { useMembershipMap, type ProfileView } from "@/lib/hooks";
import { useUi } from "@/lib/ui-state";
import { ago } from "@/lib/format";
import { FcAvatar } from "./FcAvatar";
import { WindowMark } from "./WindowMark";
import { Skeleton } from "./ui";

/**
 * The "On Farcaster" feed: real casts from Base builders, not seeded mock data.
 * Each author is matched to a Backing profile by their verified wallet: on Backing → Back,
 * not yet → Invite. This is the funding-layer thesis made visible: back the creators who are
 * already here, invite the ones who aren't.
 */
export function FarcasterFeed() {
  const { data, isLoading, isError } = useFarcasterFeed();
  const allAddresses = useMemo(() => (data ?? []).flatMap((c) => c.author.addresses), [data]);
  const { map } = useMembershipMap(allAddresses);

  if (isLoading) return <Skeleton className="h-64" />;
  if (isError)
    return <div className="surface px-6 py-12 text-center text-fg-2">Couldn&apos;t reach Farcaster right now. Try again in a moment.</div>;
  if (!data || data.length === 0)
    return <div className="surface px-6 py-12 text-center text-fg-2">No casts right now. Try again in a moment.</div>;

  return (
    <>
      <p className="px-1 text-[13px] text-muted">Real posts from builders on Farcaster. Back the ones already here, invite the rest.</p>
      {data.map((c) => (
        <FarcasterCard key={c.hash} c={c} member={c.author.addresses.map((a) => map.get(a.toLowerCase())).find(Boolean)} />
      ))}
    </>
  );
}

function FarcasterCard({ c, member }: { c: FcFeedCast; member?: ProfileView }) {
  const ui = useUi();
  const name = c.author.username;
  return (
    <article className="surface overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4">
        <FcAvatar pfp={c.author.pfp} name={name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{c.author.displayName || `@${name}`}</div>
          <div className="truncate text-[13px] text-muted">
            @{name} · on Farcaster · {ago(Math.floor(c.timestamp / 1000))}
          </div>
        </div>
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer nofollow"
          className="text-muted transition-colors hover:text-fg"
          aria-label={`View @${name}'s cast on Farcaster`}
        >
          <ArrowUpRight size={18} strokeWidth={1.5} />
        </a>
      </div>
      {c.text && <p className="whitespace-pre-line break-words px-4 pt-3 text-[16px] leading-[1.5]">{c.text}</p>}
      {c.images[0] && (
        <div className="mt-3 border-t border-[var(--line)] bg-raised">
          <img src={c.images[0]} alt={`Picture in @${name}'s cast`} loading="lazy" className="max-h-[560px] w-full object-cover" />
        </div>
      )}
      <div className="mt-1 flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-5 text-[13px] text-muted">
          <span className="num inline-flex items-center gap-1.5">
            <Heart size={14} strokeWidth={1.5} /> {c.likes}
          </span>
          <span className="num inline-flex items-center gap-1.5">
            <Repeat2 size={14} strokeWidth={1.5} /> {c.recasts}
          </span>
          <span className="num inline-flex items-center gap-1.5">
            <MessageCircle size={14} strokeWidth={1.5} /> {c.replies}
          </span>
        </div>
        {member ? (
          <button className="btn btn-primary btn-sm shrink-0" onClick={() => ui.openBack({ creator: member.account })}>
            <WindowMark size={13} /> Back @{member.profile.username}
          </button>
        ) : (
          <Link href={`/fc/${name}`} className="btn btn-secondary btn-sm shrink-0">
            Invite to Backing
          </Link>
        )}
      </div>
    </article>
  );
}
