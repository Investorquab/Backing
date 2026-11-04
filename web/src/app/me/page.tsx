"use client";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useApr, usePositions } from "@/lib/hooks";
import { ago, money, num } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { WithdrawControl } from "@/components/WithdrawControl";
import { SignIn } from "@/components/SignIn";
import { tierOf } from "@/components/TheBlock";
import { Empty, LiveNumber, PageTitle, Skeleton, Stat, StatRow } from "@/components/ui";

const YEAR = 365 * 24 * 3600;

export default function MyBacking() {
  const { address, isConnected } = useAccount();
  const { apr } = useApr();
  const { data, isLoading, dataUpdatedAt } = usePositions(address);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isConnected)
    return (
      <div className="mx-auto max-w-3xl">
        <PageTitle title="My backing" />
        <Empty title="Sign in to see who you back">
          <div className="mt-2 flex justify-center">
            <SignIn big />
          </div>
        </Empty>
      </div>
    );
  if (isLoading) return <Skeleton className="h-48" />;

  const positions = data ?? [];
  const principal = positions.reduce((s, p) => s + num(p.principal), 0);
  const generated = positions.reduce((s, p) => s + num(p.yieldGenerated), 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="My backing" sub="All of this is still yours. Withdraw any time" />
      <StatRow cols={3}>
        <Stat label="Your principal">{money(principal)}</Stat>
        <Stat label="Yield you've sent">
          <LiveNumber value={generated} perSecond={(principal * apr) / YEAR} at={dataUpdatedAt} />
        </Stat>
        <Stat label="Creators">{positions.length}</Stat>
      </StatRow>

      {notice && (
        <p className="mt-4 text-[14px] text-pos" role="status">
          {notice}
        </p>
      )}
      <div className="mt-8">
        {positions.length === 0 ? (
          <Empty title="You're not backing anyone yet">
            <Link href="/discover" className="text-lamp underline underline-offset-2">
              Find a creator
            </Link>{" "}
            and put your idle USDC to work for them
          </Empty>
        ) : (
          <ul className="surface divide-line">
            {positions.map((p) => (
              <li key={p.creator} className="px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <Avatar address={p.creator} src={p.creatorAvatar} name={p.creatorName} size={40} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/c/${p.creator}`} className="font-medium hover:underline">
                      {p.creatorName}
                    </Link>
                    <div className="num text-[12px] text-muted">
                      {tierOf(num(p.principal)).name} · since {ago(p.since)} ago
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-[15px]">{money(num(p.principal))}</div>
                    <div className="text-[12px] text-muted">
                      sent <LiveNumber value={num(p.yieldGenerated)} perSecond={(num(p.principal) * apr) / YEAR} at={dataUpdatedAt} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-start gap-2 pl-[52px]">
                  <Link href={`/c/${p.creator}#back`} className="btn btn-secondary btn-sm">
                    Add more
                  </Link>
                  <WithdrawControl creator={p.creator} principal={p.principal} onDone={setNotice} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
