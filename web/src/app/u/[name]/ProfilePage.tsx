"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { BadgeCheck, CalendarDays, Link2 } from "lucide-react";
import { useApr, useBackers, useBacking, usePeopleMap, usePostsBy, useProfile, useProfileByUsername, type PositionView, type ProfileView } from "@/lib/hooks";
import { useProfileFarcaster } from "@/lib/farcaster";
import { badges, money, num, short } from "@/lib/format";
import { useNet } from "@/lib/net";
import { useUi } from "@/lib/ui-state";
import { Avatar } from "@/components/Avatar";
import { Casts } from "@/components/Casts";
import { PostCard } from "@/components/PostCard";
import { Invite } from "@/components/Invite";
import { TheBlock } from "@/components/TheBlock";
import { WindowMark } from "@/components/WindowMark";
import { LiveNumber, Skeleton } from "@/components/ui";

const YEAR = 365 * 24 * 3600;
type Tab = "casts" | "posts" | "backers" | "backing";

export function ProfilePage() {
  const { name } = useParams<{ name: string }>();
  const byAddress = isAddress(name);
  const a = useProfile(byAddress ? (name as `0x${string}`) : undefined);
  const u = useProfileByUsername(byAddress ? undefined : decodeURIComponent(name));
  const q = byAddress ? a : u;
  const { net } = useNet();

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (!q.data)
    return byAddress ? (
      <WalletOnly address={name as `0x${string}`} />
    ) : (
      <div className="surface px-6 py-14 text-center">
        <div className="text-[20px] font-medium">No one called @{decodeURIComponent(name)}</div>
        <p className="mt-2 text-fg-2">
          Not on {net.label}, anyway.{" "}
          <Link href="/search" className="text-lamp hover:underline">
            Search people
          </Link>
        </p>
      </div>
    );
  return <Profile p={q.data} at={q.dataUpdatedAt} />;
}

function Profile({ p, at }: { p: ProfileView; at: number }) {
  const { address } = useAccount();
  const { apr, incomeApr, demo } = useApr();
  const ui = useUi();
  const people = usePeopleMap();
  const { rows: backers } = useBackers(p.account);
  const { rows: backingRows } = useBacking(p.account);
  const { rows: mine } = useBacking(address);
  const { data: posts } = usePostsBy(p.account, 50);
  const fc = useProfileFarcaster(p.account, p.profile.link);
  const [picked, setPicked] = useState<Tab | null>(null);
  // Lead with Farcaster casts when the creator is on Farcaster, until they pick a tab themselves.
  const tab: Tab = picked ?? (fc.user ? "casts" : "posts");

  const myBacking = useMemo(() => new Set((mine ?? []).map((r) => r.creator.toLowerCase())), [mine]);
  const isMe = address?.toLowerCase() === p.account.toLowerCase();
  const iBack = myBacking.has(p.account.toLowerCase());
  const total = num(p.principal);
  const u = p.profile.username;

  return (
    <div className="flex flex-col gap-4">
      <section className="surface overflow-hidden">
        <div className="flex items-start gap-4 p-5">
          <Avatar address={p.account} src={p.profile.avatar} name={u} size={88} />
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="truncate text-[24px] font-medium leading-tight">@{u}</h1>
            {p.profile.baseName && <div className="truncate text-[15px] text-fg-2">{p.profile.baseName}</div>}
            {fc.user && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]">
                <span className={`inline-flex items-center gap-1 ${fc.verified ? "text-lamp" : "text-fg-2"}`} title={fc.verified ? "Verified: this wallet is linked on Farcaster" : "Linked on Farcaster (not wallet-verified)"}>
                  {fc.verified && <BadgeCheck size={14} strokeWidth={2} />} @{fc.user.username} on Farcaster
                </span>
                <span className="num text-muted">{fc.user.followerCount.toLocaleString()} followers</span>
                {fc.user.x && (
                  <a className="text-muted hover:text-fg" href={`https://x.com/${fc.user.x}`} target="_blank" rel="noreferrer nofollow">
                    X @{fc.user.x}
                  </a>
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} strokeWidth={1.5} /> Joined {new Date(Number(p.joinedAt) * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </span>
              {p.profile.link && /^https:\/\//.test(p.profile.link) && (
                <a href={p.profile.link} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1.5 hover:text-fg">
                  <Link2 size={14} strokeWidth={1.5} /> {p.profile.link.replace(/^https:\/\/(www\.)?/, "").slice(0, 32)}
                </a>
              )}
            </div>
          </div>
        </div>
        {p.profile.bio && <p className="whitespace-pre-line px-5 pb-4 text-[15px] leading-[1.5]">{p.profile.bio}</p>}

        <div className="mx-5 flex items-end justify-between gap-4 rounded-[12px] bg-raised p-4">
          <div>
            <div className="flex items-center gap-2 text-[13px] text-fg-2">
              <WindowMark size={12} /> Earned from backers, live
            </div>
            <LiveNumber className="mt-1 block text-[32px] font-medium leading-none text-lamp" value={num(p.totalEarned)} perSecond={(total * apr) / YEAR} at={at} />
            <p className="mt-2 text-[13px] text-fg-2">
              About <span className="num text-fg">{money((total * incomeApr) / 12)}</span> a month{demo ? ` at ${Math.round(incomeApr * 100)}% a year` : ""}. Nobody spent a cent of it
            </p>
          </div>
          <TheBlock className="hidden w-[96px] shrink-0 sm:block" cols={4} minRows={3} lit={(backers ?? []).map((r) => ({ key: r.backer, amount: num(r.principal) }))} />
        </div>

        <dl className="grid grid-cols-2 gap-x-2 gap-y-4 px-5 py-4 text-center sm:grid-cols-4 sm:gap-2">
          <Stat k="Backing" v={money(total)} />
          <Stat k="Backers" v={String(Number(p.backerCount))} />
          <Stat k="Backs" v={String(Number(p.backingCount))} />
          <Stat k="Brought" v={String(Number(p.referred))} />
        </dl>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-5 py-4">
          {isMe ? (
            <Link href="/profile/edit" className="btn btn-secondary">
              Edit profile
            </Link>
          ) : (
            <button className={`btn ${iBack ? "btn-secondary" : "btn-primary"} px-6`} onClick={() => ui.openBack({ creator: p.account })}>
              {iBack && <WindowMark size={14} />}
              {iBack ? "Backing" : `Back @${u}`}
            </button>
          )}
          <Invite username={u} text={isMe ? "Back me on Backing. Your USDC stays yours, its yield supports my work" : `Back @${u} on Backing. Your USDC stays yours, the yield goes to them`} />
        </div>
      </section>

      <div className="seg self-start" role="group" aria-label="Profile">
        {fc.user && (
          <button aria-pressed={tab === "casts"} onClick={() => setPicked("casts")}>
            Casts
          </button>
        )}
        <button aria-pressed={tab === "posts"} onClick={() => setPicked("posts")}>
          Posts <span className="num ml-1 text-muted">{Number(p.postCount)}</span>
        </button>
        <button aria-pressed={tab === "backers"} onClick={() => setPicked("backers")}>
          Backers <span className="num ml-1 text-muted">{Number(p.backerCount)}</span>
        </button>
        <button aria-pressed={tab === "backing"} onClick={() => setPicked("backing")}>
          Backing <span className="num ml-1 text-muted">{Number(p.backingCount)}</span>
        </button>
      </div>

      {tab === "casts" && fc.user && <Casts fid={fc.user.fid} address={p.account} username={fc.user.username} pfp={fc.user.pfp} />}

      {tab === "posts" &&
        (posts && posts.length ? (
          posts.map((x) => <PostCard key={x.id.toString()} p={x} people={people} backing={myBacking} />)
        ) : (
          <Empty>{isMe ? "You haven't posted yet" : `@${u} hasn't posted yet`}</Empty>
        ))}

      {tab === "backers" &&
        (backers && backers.length ? (
          <People rows={backers} people={people} side="backer" me={address} title="Top backers" />
        ) : (
          <Empty>No backers yet. The first backer lights the first window</Empty>
        ))}

      {tab === "backing" &&
        (backingRows && backingRows.length ? (
          <People rows={backingRows} people={people} side="creator" me={address} title={`People @${u} backs`} />
        ) : (
          <Empty>{isMe ? "You're not backing anyone yet" : `@${u} isn't backing anyone yet`}</Empty>
        ))}
    </div>
  );
}

/** A ranked list: a creator's backers (leaderboard), or the people someone backs. */
function People({ rows, people, side, me, title }: { rows: PositionView[]; people: Map<string, ProfileView>; side: "backer" | "creator"; me?: string; title: string }) {
  return (
    <section className="surface overflow-hidden">
      <h2 className="px-4 pb-2 pt-4 text-[15px] font-medium">{title}</h2>
      <ol className="divide-line">
        {rows.map((r, i) => {
          const a = side === "backer" ? r.backer : r.creator;
          const who = people.get(a.toLowerCase());
          const href = who ? `/u/${who.profile.username}` : `/u/${a}`;
          return (
            <li key={a}>
              <Link href={href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised/60">
                <span className={`num w-5 text-[13px] ${side === "backer" && i < 3 ? "text-lamp" : "text-muted"}`}>{i + 1}</span>
                <Avatar address={a} src={who?.profile.avatar} name={who?.profile.username} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium">{who ? `@${who.profile.username}` : short(a)}</span>
                    {me?.toLowerCase() === a.toLowerCase() && <span className="text-[12px] text-lamp">you</span>}
                  </div>
                  <div className="truncate text-[12px] text-muted">
                    {badges(num(r.principal), r.since).join(" · ")} · sent {money(num(r.yieldGenerated))}
                  </div>
                </div>
                <span className="num text-[14px]">{money(num(r.principal))}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      {side === "backer" && <p className="px-4 py-3 text-[12px] text-muted">Badges: Firefly, Lamplighter from $100, Night owl from $1,000. First week, 30 nights and 100 nights for staying</p>}
    </section>
  );
}

function WalletOnly({ address }: { address: `0x${string}` }) {
  const people = usePeopleMap();
  const { rows } = useBacking(address);
  const { address: me } = useAccount();
  return (
    <div className="flex flex-col gap-4">
      <section className="surface flex items-center gap-4 p-5">
        <Avatar address={address} size={64} />
        <div>
          <h1 className="num text-[20px]">{short(address)}</h1>
          <p className="text-[14px] text-fg-2">No profile yet</p>
        </div>
      </section>
      {rows && rows.length ? <People rows={rows} people={people} side="creator" me={me} title="Backing" /> : <Empty>Not backing anyone</Empty>}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dd className="num truncate text-[16px] font-medium">{v}</dd>
      <dt className="text-[12px] text-muted">{k}</dt>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="surface px-6 py-10 text-center text-fg-2">{children}</div>;
}
