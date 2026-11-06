"use client";
/* eslint-disable @next/next/no-img-element */
import { ArrowUpRight, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { useCasts } from "@/lib/farcaster";
import { ago } from "@/lib/format";
import { Avatar } from "./Avatar";
import { FcAvatar } from "./FcAvatar";
import { Skeleton } from "./ui";

/** A creator's recent Farcaster casts. Author shown with their Backing avatar, or a Farcaster pfp when given. */
export function Casts({ fid, address, username, avatar, pfp }: { fid: number; address?: `0x${string}`; username: string; avatar?: string; pfp?: string }) {
  const { data, isLoading, isError } = useCasts(fid);
  if (isLoading) return <Skeleton className="h-40" />;
  if (isError) return <div className="surface px-6 py-10 text-center text-fg-2">Couldn&apos;t reach Farcaster right now. Try again in a moment</div>;
  if (!data || data.length === 0) return <div className="surface px-6 py-10 text-center text-fg-2">No casts yet</div>;
  return (
    <div className="flex flex-col gap-4">
      {data.map((c) => (
        <article key={c.hash} className="surface overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4">
            {pfp || !address ? <FcAvatar pfp={pfp} name={username} size={36} /> : <Avatar address={address} src={avatar} name={username} size={36} />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium">@{username}</div>
              <div className="truncate text-[13px] text-muted">on Farcaster · {ago(Math.floor(c.timestamp / 1000))}</div>
            </div>
            <a href={c.url} target="_blank" rel="noreferrer nofollow" className="text-muted transition-colors hover:text-fg" aria-label="View this cast on Farcaster">
              <ArrowUpRight size={18} strokeWidth={1.5} />
            </a>
          </div>
          {c.text && <p className="whitespace-pre-line break-words px-4 pt-3 text-[16px] leading-[1.5]">{c.text}</p>}
          {c.images[0] && (
            <div className="mt-3 border-t border-[var(--line)] bg-raised">
              <img src={c.images[0]} alt="" loading="lazy" className="max-h-[560px] w-full object-cover" />
            </div>
          )}
          <div className="flex items-center gap-5 px-4 py-3 text-[13px] text-muted">
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
        </article>
      ))}
    </div>
  );
}
