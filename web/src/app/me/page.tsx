"use client";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useApr, usePositions } from "@/lib/hooks";
import { num, since, usd } from "@/lib/format";
import { useNet } from "@/lib/net";
import { Avatar } from "@/components/Avatar";
import { WithdrawControl } from "@/components/WithdrawControl";
import { Empty, LiveNumber, Skeleton, Stat } from "@/components/ui";

const YEAR = 365 * 24 * 3600;

export default function MyBackings() {
  const { address, isConnected } = useAccount();
  const { net } = useNet();
  const { apr } = useApr();
  const { data, isLoading, dataUpdatedAt } = usePositions(address);

  if (!isConnected) return <Empty title="Connect a wallet">Connect to see who you&apos;re backing and withdraw your principal.</Empty>;
  if (isLoading) return <Skeleton className="h-48" />;

  const positions = data ?? [];
  const principal = positions.reduce((s, p) => s + num(p.principal), 0);
  const generated = positions.reduce((s, p) => s + num(p.yieldGenerated), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My backings</h1>
        <p className="mt-1 text-muted">Everything here is still yours. Withdraw any time.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Your principal">
          <span className="num">${usd(principal)}</span>
        </Stat>
        <Stat label="Yield you've sent" hint="to creators, live">
          <LiveNumber className="text-ok" value={generated} perSecond={(principal * apr) / YEAR} at={dataUpdatedAt} />
        </Stat>
        <Stat label="Creators backed">
          <span className="num">{positions.length}</span>
        </Stat>
      </div>

      {positions.length === 0 ? (
        <Empty title="You're not backing anyone yet">
          <Link href="/#creators" className="text-lamp underline">
            Find a creator
          </Link>{" "}
          and put your idle {net.symbol} to work for them.
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {positions.map((p) => (
            <li key={p.creator} className="card p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <Avatar address={p.creator} src={p.creatorAvatar} name={p.creatorName} size={44} />
                <div className="min-w-0 flex-1">
                  <Link href={`/c/${p.creator}`} className="font-semibold hover:text-lamp">
                    {p.creatorName}
                  </Link>
                  <div className="text-xs text-dim">Backing for {since(p.since)}</div>
                </div>
                <div className="text-right">
                  <div className="num font-semibold">${usd(num(p.principal))}</div>
                  <div className="num text-xs text-ok">
                    sent{" "}
                    <LiveNumber value={num(p.yieldGenerated)} perSecond={(num(p.principal) * apr) / YEAR} at={dataUpdatedAt} />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-start gap-2">
                <Link href={`/c/${p.creator}`} className="btn btn-ghost px-4 py-2 text-sm">
                  Top up
                </Link>
                <WithdrawControl creator={p.creator} principal={p.principal} compact />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
