"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BadgeCheck, Users } from "lucide-react";
import { useFarcasterUser } from "@/lib/farcaster";
import { useProfileAmong } from "@/lib/hooks";
import { useUi } from "@/lib/ui-state";
import { money, num } from "@/lib/format";
import { FcAvatar } from "@/components/FcAvatar";
import { Casts } from "@/components/Casts";
import { Invite } from "@/components/Invite";
import { WindowMark } from "@/components/WindowMark";
import { Skeleton } from "@/components/ui";

export default function FarcasterProfilePage() {
  const { username } = useParams<{ username: string }>();
  const uname = decodeURIComponent(username).replace(/^@/, "");
  const { data: fc, isLoading, isError } = useFarcasterUser(uname);
  const ui = useUi();
  const member = useProfileAmong(fc?.addresses);

  if (isLoading) return <Skeleton className="h-96" />;
  if (isError || !fc)
    return (
      <div className="surface px-6 py-14 text-center">
        <div className="text-[20px] font-medium">No Farcaster user @{uname}</div>
        <p className="mt-2 text-fg-2">
          Check the handle, or{" "}
          <Link href="/search" className="text-lamp hover:underline">
            search again
          </Link>
        </p>
      </div>
    );

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/fc/${fc.username}` : "";

  return (
    <div className="flex flex-col gap-4">
      <section className="surface overflow-hidden">
        <div className="flex items-start gap-4 p-5">
          <FcAvatar pfp={fc.pfp} name={fc.username} size={88} />
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="truncate text-[24px] font-medium leading-tight">{fc.displayName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]">
              <span className="inline-flex items-center gap-1 text-lamp">
                <BadgeCheck size={14} strokeWidth={2} /> @{fc.username} on Farcaster
              </span>
              <span className="num inline-flex items-center gap-1 text-muted">
                <Users size={13} strokeWidth={1.5} /> {fc.followerCount.toLocaleString()}
              </span>
              {fc.x && (
                <a className="text-muted hover:text-fg" href={`https://x.com/${fc.x}`} target="_blank" rel="noreferrer nofollow">
                  X @{fc.x}
                </a>
              )}
            </div>
          </div>
        </div>
        {fc.bio && <p className="whitespace-pre-line px-5 pb-4 text-[15px] leading-[1.5]">{fc.bio}</p>}

        <div className="border-t border-[var(--line)] p-5">
          {member.data === undefined ? (
            <div className="h-10 animate-pulse rounded-[10px] bg-raised" />
          ) : member.data ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[14px] text-pos">
                <WindowMark size={14} /> On Backing as @{member.data.profile.username}
                <span className="text-fg-2">· {Number(member.data.backerCount)} backer{Number(member.data.backerCount) === 1 ? "" : "s"} · {money(num(member.data.principal))} backing</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary px-6" onClick={() => ui.openBack({ creator: member.data!.account })}>
                  Back @{member.data.profile.username}
                </button>
                <Link href={`/u/${member.data.profile.username}`} className="btn btn-secondary">
                  Full profile
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[14px] text-fg-2">
                <span className="font-medium text-fg">Not on Backing yet.</span> Invite them — when they join and link this Farcaster account, their backers can support them with money that stays the
                backer&apos;s own.
              </p>
              <Invite
                username={fc.username}
                url={inviteUrl}
                farcasterHandle={fc.username}
                xHandle={fc.x}
                text="your followers can back you on Backing — they keep their money, you earn the yield. Claim your profile:"
              />
            </div>
          )}
        </div>
      </section>

      <h2 className="px-1 text-[15px] font-medium text-fg-2">Recent casts</h2>
      <Casts fid={fc.fid} username={fc.username} pfp={fc.pfp} />
    </div>
  );
}
