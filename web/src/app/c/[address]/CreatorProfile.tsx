"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { CalendarDays, MessageSquareQuote } from "lucide-react";
import { useApr, useBackers, useCasts, useCreator, useCreatorActivity, useCreatorMap, useCreatorPosts, usePositions, Kind } from "@/lib/hooks";
import { dateLabel, money, num, short, terms } from "@/lib/format";
import { useNet } from "@/lib/net";
import { useMiniApp } from "@/lib/miniapp";
import { useUi } from "@/lib/ui-state";
import { safeImage } from "@/lib/images";
import { xProfileUrl } from "@/lib/x";
import { useXVerified } from "@/lib/xhooks";
import { Avatar } from "@/components/Avatar";
import { PostCard } from "@/components/PostCard";
import { ShareRow } from "@/components/ShareRow";
import { TheBlock, tierOf } from "@/components/TheBlock";
import { WindowMark } from "@/components/WindowMark";
import { PageHeader, Tabs } from "@/components/Shell";
import { Verified, XGlyph } from "@/components/XBits";
import { LiveNumber, Skeleton } from "@/components/ui";

const YEAR = 365 * 24 * 3600;
type Tab = "posts" | "backers" | "about";

export function CreatorProfile() {
  const { address: addr } = useParams<{ address: string }>();
  const ok = isAddress(addr);
  const a = ok ? (addr as `0x${string}`) : undefined;
  const { net } = useNet();
  const { address } = useAccount();
  const mini = useMiniApp();
  const ui = useUi();
  const { apr, incomeApr, demo } = useApr();
  const { data: c, isLoading, missing, dataUpdatedAt } = useCreator(a);
  const { rows } = useBackers(a);
  const { data: posts } = useCreatorPosts(a, 60);
  const { data: activity } = useCreatorActivity(a, 80);
  const { data: casts } = useCasts(a);
  const creators = useCreatorMap();
  const { data: mine } = usePositions(address);
  const verified = useXVerified(c);
  const [tab, setTab] = useState<Tab>("posts");

  const backingSet = useMemo(() => new Set((mine ?? []).filter((p) => p.principal > 0n).map((p) => p.creator.toLowerCase())), [mine]);
  const notes = useMemo(() => (activity ?? []).filter((x) => x.kind === Kind.Backed && x.text), [activity]);

  if (!ok)
    return (
      <>
        <PageHeader title="Profile" back />
        <p className="p-8 text-center text-fg-2">That isn&apos;t a wallet address</p>
      </>
    );
  if (isLoading)
    return (
      <>
        <PageHeader title="Profile" back />
        <div className="p-4">
          <Skeleton className="h-80" />
        </div>
      </>
    );
  if (missing || !c)
    return (
      <>
        <PageHeader title="Profile" back />
        <div className="px-8 py-16 text-center">
          <div className="text-[20px] font-medium">No creator here</div>
          <p className="mt-2 text-fg-2">
            {short(addr)} hasn&apos;t set up a profile on {net.label}.{" "}
            <Link className="text-lamp hover:underline" href="/discover">
              Browse creators
            </Link>
          </p>
        </div>
      </>
    );

  const p = num(c.principal);
  const isMe = address?.toLowerCase() === c.creator.toLowerCase();
  const iBack = backingSet.has(c.creator.toLowerCase());
  const banner = safeImage(c.banner);
  const myRow = rows?.find((r) => r.backer.toLowerCase() === address?.toLowerCase());

  return (
    <>
      <PageHeader title={c.name} sub={`${Number(c.postCount)} post${Number(c.postCount) === 1 ? "" : "s"}`} back />

      <div className="relative">
        <div className="aspect-[3/1] w-full overflow-hidden border-b border-[var(--line)] bg-deep">
          {banner ? (
            <img src={banner} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-end justify-end gap-[6px] px-6 pb-0 opacity-90" aria-hidden>
              <TheBlock className="w-[120px] translate-y-2" cols={4} minRows={3} lit={(rows ?? []).map((r) => ({ key: r.backer, amount: num(r.principal) }))} />
            </div>
          )}
        </div>
        <div className="px-4">
          <div className="flex items-end justify-between">
            <div className="-mt-[40px] rounded-full border-4 border-bg sm:-mt-[64px]">
              <span className="sm:hidden">
                <Avatar address={c.creator} src={c.avatar} name={c.name} size={80} />
              </span>
              <span className="hidden sm:block">
                <Avatar address={c.creator} src={c.avatar} name={c.name} size={120} />
              </span>
            </div>
            <div className="flex gap-2 pt-3">
              {isMe ? (
                <Link href="/creator" className="btn btn-secondary">
                  Edit profile
                </Link>
              ) : (
                <button className={`btn ${iBack ? "btn-secondary" : "btn-primary"}`} onClick={() => ui.openBack({ creator: c.creator })}>
                  {iBack && <WindowMark size={14} />} {iBack ? "Backing" : "Back"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[22px] font-medium leading-tight">{c.name}</h2>
              {verified && <Verified />}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[15px] text-muted">
              {c.x && <span>@{c.x}</span>}
              {c.handle && c.handle !== c.x && <span>{c.handle} on Base App</span>}
            </div>
          </div>
          {c.bio && <p className="mt-3 whitespace-pre-line text-[15px]">{c.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted">
            {c.x && (
              <a href={xProfileUrl(c.x)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-fg">
                <XGlyph size={13} /> x.com/{c.x}
              </a>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={15} strokeWidth={1.5} /> Joined {new Date(Number(c.registeredAt) * 1000).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
            <span>
              <span className="num font-medium">{money(p)}</span> <span className="text-muted">backing</span>
            </span>
            <span>
              <span className="num font-medium">{Number(c.backerCount)}</span> <span className="text-muted">backer{Number(c.backerCount) === 1 ? "" : "s"}</span>
            </span>
            <span>
              <span className="num font-medium">{money((p * incomeApr) / 12)}</span> <span className="text-muted">a month{demo ? ` at ${Math.round(incomeApr * 100)}%` : ""}</span>
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 rounded-[14px] border border-[var(--line)] p-4">
            <div>
              <div className="flex items-center gap-2 text-[13px] text-fg-2">
                <WindowMark size={12} /> Earned from backers, live
              </div>
              <LiveNumber className="mt-1 block text-[28px] font-medium leading-none text-lamp" value={num(c.totalEarned)} perSecond={(p * apr) / YEAR} at={dataUpdatedAt} />
              <p className="mt-2 text-[13px] text-fg-2">Nobody spent a cent of this. It&apos;s the yield on backers&apos; capital</p>
            </div>
            {myRow && <span className="num shrink-0 text-right text-[12px] text-muted">You: {money(num(myRow.principal))}<br />{terms(myRow.endsAt, myRow.lockedUntil).label}</span>}
          </div>
          <div className="mt-3 pb-1">
            <ShareRow address={c.creator} name={c.name} mine={isMe} />
          </div>
        </div>
      </div>

      <div className="sticky top-[calc(56px+56px)] z-10 mt-2 border-b border-[var(--line)] bg-bg/90 backdrop-blur md:top-14">
        <Tabs<Tab>
          tabs={[
            ["posts", "Posts"],
            ["backers", "Backers"],
            ["about", "About"],
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "posts" &&
        (!posts || posts.length === 0 ? (
          <Empty title={isMe ? "Your posts show here" : `${c.name} hasn't posted yet`}>{isMe ? "Post something from the Post button. It lands in your backers' Following tab" : "Back them to see their posts first in your Following tab"}</Empty>
        ) : (
          posts.map((x) => <PostCard key={x.id.toString()} p={x} creators={creators} backing={backingSet} />)
        ))}

      {tab === "backers" &&
        (!rows || rows.length === 0 ? (
          <Empty title="No backers yet">The first backer lights the first window</Empty>
        ) : (
          <>
            <ol>
              {rows.map((r, i) => {
                const bc = creators.get(r.backer.toLowerCase());
                const t = terms(r.endsAt, r.lockedUntil);
                return (
                  <li key={r.backer} className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
                    <span className={`num w-5 text-[13px] ${i < 3 ? "text-lamp" : "text-muted"}`}>{i + 1}</span>
                    <Avatar address={r.backer} src={bc?.avatar} name={bc?.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-medium">{bc?.name ?? short(r.backer)}</span>
                        {address?.toLowerCase() === r.backer.toLowerCase() && <span className="text-[12px] text-lamp">you</span>}
                      </div>
                      <div className="num text-[12px] text-muted">
                        {tierOf(num(r.principal)).name} · {t.locked ? "Committed · " : ""}
                        {t.label} · sent {money(num(r.generated))}
                      </div>
                    </div>
                    <div className="num text-[14px]">{money(num(r.principal))}</div>
                  </li>
                );
              })}
            </ol>
            {notes.length > 0 && (
              <div className="px-4 pb-2 pt-6">
                <h3 className="mb-2 text-[15px] font-medium">Notes from backers</h3>
                <ul className="flex flex-col gap-3">
                  {notes.slice(0, 20).map((n) => (
                    <li key={n.id.toString()} className="border-l-2 border-[var(--line-2)] pl-3">
                      <p className="text-[15px]">{n.text}</p>
                      <p className="num mt-1 text-[12px] text-muted">
                        {creators.get(n.actor.toLowerCase())?.name ?? short(n.actor)} · {money(num(n.amount))}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="px-4 py-3 text-[12px] text-muted">Firefly under $100 · Lamplighter $100 and up · Night owl $1,000 and up · Committed means locked</p>
          </>
        ))}

      {tab === "about" && (
        <div className="flex flex-col gap-5 px-4 py-5 text-[15px]">
          <TheBlock className="w-[180px]" cols={5} minRows={4} lit={(rows ?? []).map((r) => ({ key: r.backer, amount: num(r.principal), label: short(r.backer) }))} />
          <dl className="divide-line rounded-[14px] border border-[var(--line)] px-4">
            <Row k="Wallet">
              {net.explorer ? (
                <a className="num hover:underline" href={`${net.explorer}/address/${c.creator}`} target="_blank" rel="noreferrer">
                  {short(c.creator)}
                </a>
              ) : (
                <span className="num">{short(c.creator)}</span>
              )}
            </Row>
            <Row k="X">{c.x ? `@${c.x}${verified ? ", linked" : ", not linked yet"}` : "Not added"}</Row>
            <Row k="Base App">
              {c.handle ? (
                mini.inMiniApp && c.fid > 0n ? (
                  <button className="hover:underline" onClick={() => mini.viewProfile(Number(c.fid))}>
                    {c.handle}
                  </button>
                ) : (
                  c.handle
                )
              ) : (
                "Not added"
              )}
            </Row>
            <Row k="Claimed so far">
              <span className="num">{money(num(c.totalClaimed))}</span>
            </Row>
            <Row k="Joined">{dateLabel(c.registeredAt)}</Row>
          </dl>
          {casts && casts.length > 0 && (
            <div>
              <h3 className="mb-2 text-[15px] font-medium">Casts that brought backing</h3>
              <ul className="divide-line rounded-[14px] border border-[var(--line)]">
                {casts.map((x) => (
                  <li key={x.cast} className="flex items-center gap-3 px-4 py-3">
                    <MessageSquareQuote size={18} strokeWidth={1.5} className="text-fg-2" />
                    <div className="min-w-0 flex-1 text-[14px]">
                      <span className="num">{money(num(x.backed))}</span> from {Number(x.backings)} backing{Number(x.backings) === 1 ? "" : "s"}
                    </div>
                    {mini.inMiniApp && (
                      <button className="btn btn-secondary btn-sm" onClick={() => mini.viewCast(x.cast, c.handle || undefined)}>
                        View cast
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!isMe && (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-20 border-t border-[var(--line)] bg-bg/95 p-3 backdrop-blur md:hidden">
          <button className="btn btn-primary w-full" onClick={() => ui.openBack({ creator: c.creator })}>
            {iBack ? `Add to your backing` : `Back ${c.name}`}
          </button>
        </div>
      )}
    </>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-fg-2">{k}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-8 py-14 text-center">
      <div className="text-[20px] font-medium">{title}</div>
      {children && <p className="mx-auto mt-2 max-w-sm text-fg-2">{children}</p>}
    </div>
  );
}
