"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { useApr, useBackers, useCreator } from "@/lib/hooks";
import { compact, num, short, usd } from "@/lib/format";
import { useNet } from "@/lib/net";
import { Avatar } from "@/components/Avatar";
import { BackPanel } from "@/components/BackPanel";
import { ShareRow } from "@/components/ShareRow";
import { Badge, Empty, LiveNumber, Skeleton, Stat } from "@/components/ui";

const YEAR = 365 * 24 * 3600;

export default function CreatorPage() {
  const params = useParams<{ address: string }>();
  const addr = params.address;
  const ok = isAddress(addr);
  const { net } = useNet();
  const { address } = useAccount();
  const { apr, incomeApr, demo } = useApr();
  const { data: c, isLoading, missing, dataUpdatedAt } = useCreator(ok ? (addr as `0x${string}`) : undefined);
  const { rows } = useBackers(ok ? (addr as `0x${string}`) : undefined);

  if (!ok) return <Empty title="That isn't a valid address" />;
  if (isLoading) return <Skeleton className="h-64" />;
  if (missing || !c)
    return (
      <Empty title="No creator here">
        {short(addr)} hasn&apos;t set up a profile on {net.label}. <Link className="text-lamp underline" href="/">Browse creators</Link>
      </Empty>
    );

  const p = num(c.principal);
  const perSec = (p * apr) / YEAR;
  const isMe = address?.toLowerCase() === c.creator.toLowerCase();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-6">
        <section className="card p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <Avatar address={c.creator} src={c.avatar} name={c.name} size={72} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{c.name}</h1>
              <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-dim">
                {c.handle && (
                  <a className="hover:text-fg" href={`https://x.com/${c.handle}`} target="_blank" rel="noreferrer">
                    @{c.handle}
                  </a>
                )}
                {net.explorer ? (
                  <a className="num hover:text-fg" href={`${net.explorer}/address/${c.creator}`} target="_blank" rel="noreferrer">
                    {short(c.creator)}
                  </a>
                ) : (
                  <span className="num">{short(c.creator)}</span>
                )}
              </div>
            </div>
          </div>
          {c.bio && <p className="mt-4 whitespace-pre-line text-muted">{c.bio}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <ShareRow address={c.creator} name={c.name} />
            {isMe && (
              <Link href="/creator" className="btn btn-lamp px-4 py-2 text-sm">
                Open creator dashboard
              </Link>
            )}
          </div>
        </section>

        <section className="card relative overflow-hidden p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-dim">
            <span className="live-dot" /> Earned from backers, live
          </div>
          <LiveNumber className="glow mt-2 block text-4xl font-bold text-lamp sm:text-5xl" value={num(c.totalEarned)} perSecond={perSec} at={dataUpdatedAt} />
          <p className="mt-2 text-sm text-muted">
            Nobody spent a cent of this. It&apos;s the yield on {Number(c.backerCount)} backer
            {Number(c.backerCount) === 1 ? "'s" : "s'"} capital.
          </p>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <Stat label="Backing">
            <span className="num">${compact(p)}</span>
          </Stat>
          <Stat label="Backers">
            <span className="num">{Number(c.backerCount)}</span>
          </Stat>
          <Stat label="Est. / month" hint={demo ? `at ${Math.round(incomeApr * 100)}% real APY` : undefined}>
            <span className="num text-ok">${usd((p * incomeApr) / 12)}</span>
          </Stat>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Top backers</h2>
          {!rows || rows.length === 0 ? (
            <Empty title="No backers yet">Be the first to back {c.name}.</Empty>
          ) : (
            <ol className="card divide-y divide-line">
              {rows.slice(0, 20).map((r, i) => (
                <li key={r.backer} className="flex items-center gap-3 px-4 py-3">
                  <span className={`num w-5 text-sm ${i < 3 ? "text-lamp" : "text-dim"}`}>{i + 1}</span>
                  <Avatar address={r.backer} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="num truncate text-sm">{short(r.backer)}</span>
                      {address?.toLowerCase() === r.backer.toLowerCase() && <span className="text-xs text-lamp">you</span>}
                      <Badge principal={num(r.principal)} />
                    </div>
                    <div className="num whitespace-nowrap text-xs text-dim">sent ${usd(num(r.generated))} in yield</div>
                  </div>
                  <div className="num text-right text-sm">${compact(num(r.principal))}</div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-xs text-dim">Badges: Firefly under $100 · Lamplighter $100+ · Night Owl $1,000+</p>
        </section>
      </div>

      <aside id="back" className="scroll-mt-28 lg:sticky lg:top-24 lg:self-start">
        <BackPanel creator={c} />
      </aside>

      {!isMe && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/90 p-3 backdrop-blur lg:hidden">
          <a href="#back" className="btn btn-lamp w-full">
            Back {c.name}
          </a>
        </div>
      )}
    </div>
  );
}
