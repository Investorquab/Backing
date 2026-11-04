"use client";
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { MessageSquareQuote } from "lucide-react";
import { Kind, useApr, useBackers, useCasts, useCreator, useCreatorActivity, useCreatorMap } from "@/lib/hooks";
import { money, num, short } from "@/lib/format";
import { useNet } from "@/lib/net";
import { useMiniApp } from "@/lib/miniapp";
import { Avatar } from "@/components/Avatar";
import { BackPanel } from "@/components/BackPanel";
import { FeedItem } from "@/components/FeedItem";
import { ShareRow } from "@/components/ShareRow";
import { TheBlock, tierOf } from "@/components/TheBlock";
import { WindowMark } from "@/components/WindowMark";
import { Empty, LiveNumber, Skeleton } from "@/components/ui";

const YEAR = 365 * 24 * 3600;
type Tab = "updates" | "backers" | "casts";

export function CreatorProfile() {
  const params = useParams<{ address: string }>();
  const addr = params.address;
  const ok = isAddress(addr);
  const a = ok ? (addr as `0x${string}`) : undefined;
  const { net } = useNet();
  const { address } = useAccount();
  const mini = useMiniApp();
  const { apr, incomeApr, demo } = useApr();
  const { data: c, isLoading, missing, dataUpdatedAt } = useCreator(a);
  const { rows } = useBackers(a);
  const { data: act } = useCreatorActivity(a, 60);
  const { data: casts } = useCasts(a);
  const creators = useCreatorMap();
  const [tab, setTab] = useState<Tab>("updates");

  if (!ok) return <Empty title="That isn't a wallet address" />;
  if (isLoading) return <Skeleton className="h-96" />;
  if (missing || !c)
    return (
      <Empty title="No creator here">
        {short(addr)} hasn&apos;t set up a profile on {net.label}.{" "}
        <Link className="text-lamp underline underline-offset-2" href="/discover">
          Browse creators
        </Link>
      </Empty>
    );

  const p = num(c.principal);
  const isMe = address?.toLowerCase() === c.creator.toLowerCase();
  const updates = (act ?? []).filter((x) => x.kind === Kind.Posted || x.kind === Kind.Milestone);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="flex items-start gap-4">
          <Avatar address={c.creator} src={c.avatar} name={c.name} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-medium leading-tight tracking-[-0.01em]">{c.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[14px] text-muted">
              {c.handle &&
                (mini.inMiniApp && c.fid > 0n ? (
                  <button className="hover:text-fg" onClick={() => mini.viewProfile(Number(c.fid))}>
                    @{c.handle}
                  </button>
                ) : (
                  <span>@{c.handle}</span>
                ))}
              {net.explorer ? (
                <a className="num hover:text-fg" href={`${net.explorer}/address/${c.creator}`} target="_blank" rel="noreferrer">
                  {short(c.creator)}
                </a>
              ) : (
                <span className="num">{short(c.creator)}</span>
              )}
            </div>
            {c.bio && <p className="mt-3 whitespace-pre-line text-fg-2">{c.bio}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <ShareRow address={c.creator} name={c.name} mine={isMe} />
              {isMe && (
                <Link href="/creator" className="btn btn-quiet btn-sm">
                  Open studio
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="surface grid grid-cols-1 gap-6 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-[13px] text-fg-2">
              <WindowMark size={12} /> Earned from backers, live
            </div>
            <LiveNumber className="mt-2 block text-[40px] font-medium leading-none text-lamp sm:text-[48px]" value={num(c.totalEarned)} perSecond={(p * apr) / YEAR} at={dataUpdatedAt} />
            <p className="mt-3 max-w-sm text-[14px] text-fg-2">
              Nobody spent a cent of this. It&apos;s the yield on {Number(c.backerCount)} backer{Number(c.backerCount) === 1 ? "'s" : "s'"} capital
            </p>
            <dl className="mt-auto grid grid-cols-3 gap-4 pt-6">
              <div>
                <dt className="text-[13px] text-fg-2">Backing</dt>
                <dd className="num mt-1 text-[17px]">{money(p)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-fg-2">Backers</dt>
                <dd className="num mt-1 text-[17px]">{Number(c.backerCount)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-fg-2">A month</dt>
                <dd className="num mt-1 text-[17px]">{money((p * incomeApr) / 12)}</dd>
              </div>
            </dl>
            {demo && <p className="mt-2 text-[12px] text-muted">Monthly figure at a real-world {Math.round(incomeApr * 100)}% a year</p>}
          </div>
          <TheBlock className="w-full max-w-[200px] justify-self-center sm:w-[180px]" cols={5} minRows={5} lit={(rows ?? []).map((r) => ({ key: r.backer, amount: num(r.principal), label: short(r.backer) }))} />
        </section>

        <section>
          <div className="seg mb-3" role="group" aria-label="Profile sections">
            <button aria-pressed={tab === "updates"} onClick={() => setTab("updates")}>
              Updates
            </button>
            <button aria-pressed={tab === "backers"} onClick={() => setTab("backers")}>
              Backers <span className="num ml-1 text-muted">{Number(c.backerCount)}</span>
            </button>
            <button aria-pressed={tab === "casts"} onClick={() => setTab("casts")}>
              Casts <span className="num ml-1 text-muted">{Number(c.castCount)}</span>
            </button>
          </div>

          {tab === "updates" &&
            (updates.length === 0 ? (
              <Empty title="No updates yet">{isMe ? "Post one from your studio. It lands in your backers' feeds" : `${c.name} hasn't posted yet`}</Empty>
            ) : (
              <div className="surface divide-line">
                {updates.map((x) => (
                  <FeedItem key={x.id.toString()} a={x} creators={creators} compact />
                ))}
              </div>
            ))}

          {tab === "backers" &&
            (!rows || rows.length === 0 ? (
              <Empty title="No backers yet">The first backer lights the first window</Empty>
            ) : (
              <>
                <ol className="surface divide-line">
                  {rows.slice(0, 50).map((r, i) => (
                    <li key={r.backer} className="flex items-center gap-3 px-4 py-3">
                      <span className={`num w-5 text-[13px] ${i < 3 ? "text-lamp" : "text-muted"}`}>{i + 1}</span>
                      <Avatar address={r.backer} src={creators.get(r.backer.toLowerCase())?.avatar} name={creators.get(r.backer.toLowerCase())?.name} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="num truncate text-[14px]">{creators.get(r.backer.toLowerCase())?.name ?? short(r.backer)}</span>
                          {address?.toLowerCase() === r.backer.toLowerCase() && <span className="text-[12px] text-lamp">you</span>}
                        </div>
                        <div className="num text-[12px] text-muted">
                          {tierOf(num(r.principal)).name} · sent {money(num(r.generated))}
                        </div>
                      </div>
                      <div className="num text-[14px]">{money(num(r.principal))}</div>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[12px] text-muted">Firefly under $100 · Lamplighter $100 and up · Night owl $1,000 and up</p>
              </>
            ))}

          {tab === "casts" &&
            (!casts || casts.length === 0 ? (
              <Empty title="No casts have brought backing yet">When someone backs {c.name} from a cast in Base App, that cast shows here with how much it raised</Empty>
            ) : (
              <ul className="surface divide-line">
                {casts.map((x) => (
                  <li key={x.cast} className="flex items-center gap-3 px-4 py-3">
                    <MessageSquareQuote size={18} strokeWidth={1.5} className="text-fg-2" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px]">
                        Brought <span className="num">{money(num(x.backed))}</span> from {Number(x.backings)} backing{Number(x.backings) === 1 ? "" : "s"}
                      </div>
                      <div className="num text-[12px] text-muted">{x.cast.slice(0, 14)}…</div>
                    </div>
                    {mini.inMiniApp && (
                      <button className="btn btn-secondary btn-sm" onClick={() => mini.viewCast(x.cast, c.handle || undefined)}>
                        View cast
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ))}
        </section>
      </div>

      <aside id="back" className="scroll-mt-20 lg:sticky lg:top-20 lg:self-start">
        <BackPanel creator={c} />
      </aside>

      {!isMe && (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-20 border-t border-[var(--line)] bg-deep/95 p-3 backdrop-blur md:bottom-0 lg:hidden">
          <a href="#back" className="btn btn-primary w-full">
            Back {c.name}
          </a>
        </div>
      )}
    </div>
  );
}
