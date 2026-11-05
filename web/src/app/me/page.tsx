"use client";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useApr, usePositions } from "@/lib/hooks";
import { money, num } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { PositionControls } from "@/components/PositionControls";
import { PageHeader } from "@/components/Shell";
import { SignIn } from "@/components/SignIn";
import { LiveNumber, Skeleton, Stat, StatRow } from "@/components/ui";

const YEAR = 365 * 24 * 3600;

export default function MyBacking() {
  const { address, isConnected } = useAccount();
  const { apr } = useApr();
  const { data, isLoading, dataUpdatedAt } = usePositions(address);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isConnected)
    return (
      <>
        <PageHeader title="My backing" />
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <div className="text-[20px] font-medium">Sign in to see who you back</div>
          <SignIn big />
        </div>
      </>
    );

  const positions = (data ?? []).filter((p) => p.principal > 0n);
  const principal = positions.reduce((s, p) => s + num(p.principal), 0);
  const generated = positions.reduce((s, p) => s + num(p.yieldGenerated), 0);

  return (
    <>
      <PageHeader title="My backing" sub="All of this is still yours" />
      <div className="p-4">
        <StatRow cols={3}>
          <Stat label="Your principal">{money(principal)}</Stat>
          <Stat label="Yield sent">
            <LiveNumber value={generated} perSecond={(principal * apr) / YEAR} at={dataUpdatedAt} />
          </Stat>
          <Stat label="Creators">{positions.length}</Stat>
        </StatRow>
        {notice && (
          <p className="mt-3 text-[14px] text-pos" role="status">
            {notice}
          </p>
        )}
      </div>
      {isLoading ? (
        <div className="px-4">
          <Skeleton className="h-40" />
        </div>
      ) : positions.length === 0 ? (
        <div className="px-8 py-12 text-center">
          <div className="text-[20px] font-medium">You&apos;re not backing anyone yet</div>
          <p className="mt-2 text-fg-2">
            <Link href="/discover" className="text-lamp hover:underline">
              Find a creator
            </Link>{" "}
            and put your idle USDC to work for them
          </p>
        </div>
      ) : (
        <ul>
          {positions.map((p) => (
            <li key={p.creator} className="border-b border-[var(--line)] px-4 py-4">
              <Link href={`/c/${p.creator}`} className="mb-3 flex items-center gap-3">
                <Avatar address={p.creator} src={p.creatorAvatar} name={p.creatorName} size={40} />
                <span className="font-medium hover:underline">{p.creatorName}</span>
              </Link>
              <PositionControls p={p} at={dataUpdatedAt} onDone={setNotice} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
