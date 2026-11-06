"use client";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { backingAbi } from "@/lib/abi";
import { useApr, useBacking, usePeopleMap, useProfile, useTx, type ProfileView } from "@/lib/hooks";
import { badges, countdown, money, num, short } from "@/lib/format";
import { useNet } from "@/lib/net";
import { Avatar } from "@/components/Avatar";
import { Invite } from "@/components/Invite";
import { SignIn } from "@/components/SignIn";
import { Withdraw } from "@/components/Withdraw";
import { WindowMark } from "@/components/WindowMark";
import { LiveNumber, Skeleton, Stat, StatRow, TxStatus, useNow } from "@/components/ui";

const YEAR = 365 * 24 * 3600;

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { data: me, dataUpdatedAt } = useProfile(address);
  if (!isConnected)
    return (
      <div className="surface flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="text-[20px] font-medium">Connect to see your portfolio</div>
        <SignIn big />
      </div>
    );
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[22px] font-medium">Portfolio</h1>
      {me && <Earnings me={me} at={dataUpdatedAt} />}
      <MyBacking address={address!} />
      {me ? (
        <Grow me={me} />
      ) : (
        <div className="surface flex items-center justify-between gap-3 p-4 text-[15px] text-fg-2">
          Want to be backed too? Make a profile
          <Link href="/profile/edit" className="btn btn-primary btn-sm px-4">
            Create profile
          </Link>
        </div>
      )}
    </div>
  );
}

/** What you earn as a creator, and claiming it. */
function Earnings({ me, at }: { me: ProfileView; at: number }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { apr, incomeApr } = useApr();
  const tx = useTx();
  const now = useNow();
  const total = num(me.principal);
  const wait = Number(me.nextClaimAt) - now;
  const canClaim = wait <= 0 && me.claimable > 0n;
  const epoch = d.epochSeconds >= 86400 ? `${d.epochSeconds / 86400} day${d.epochSeconds === 86400 ? "" : "s"}` : `${Math.round(d.epochSeconds / 60)} minutes`;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[17px] font-medium">Your earnings</h2>
      <div className="surface p-5">
        <div className="flex items-center gap-2 text-[13px] text-fg-2">
          <WindowMark size={12} /> Ready to claim
        </div>
        <LiveNumber className="mt-2 block text-[40px] font-medium leading-none text-lamp" value={num(me.claimable)} perSecond={(total * apr) / YEAR} at={at} />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="btn btn-primary"
            disabled={!canClaim || tx.state.status === "pending"}
            onClick={() =>
              tx.send([{ label: "Claim", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "claim" }) }], "Claimed. It's in your wallet")
            }
          >
            Claim to wallet
          </button>
          <span className="text-[14px] text-fg-2">{wait > 0 ? `Next claim in ${countdown(wait)}` : me.claimable > 0n ? "You can claim now" : "Nothing to claim yet"} · once every {epoch}</span>
        </div>
        <TxStatus state={tx.state} />
      </div>
      <StatRow cols={4}>
        <Stat label="Backing you">{money(total)}</Stat>
        <Stat label="Backers">{Number(me.backerCount)}</Stat>
        <Stat label="A month" note={`at ${Math.round(incomeApr * 100)}% a year`}>
          {money((total * incomeApr) / 12)}
        </Stat>
        <Stat label="Claimed">{money(num(me.totalClaimed))}</Stat>
      </StatRow>
    </section>
  );
}

/** Everyone you back: what's yours, what it has sent them, and taking it back. */
function MyBacking({ address }: { address: `0x${string}` }) {
  const { apr } = useApr();
  const { rows, isLoading, dataUpdatedAt } = useBacking(address);
  const people = usePeopleMap();
  const [notice, setNotice] = useState<string | null>(null);
  const principal = (rows ?? []).reduce((s, r) => s + num(r.principal), 0);
  const sent = (rows ?? []).reduce((s, r) => s + num(r.yieldGenerated), 0);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[17px] font-medium">You&apos;re backing</h2>
      <StatRow cols={3}>
        <Stat label="Yours, staked">{money(principal)}</Stat>
        <Stat label="Yield you've sent">
          <LiveNumber value={sent} perSecond={(principal * apr) / YEAR} at={dataUpdatedAt} />
        </Stat>
        <Stat label="People">{rows?.length ?? 0}</Stat>
      </StatRow>
      {principal > 0 && (
        <p className="text-[14px] leading-[1.5] text-fg-2">
          Your <span className="num text-fg">{money(principal)}</span> is still yours, withdraw any time. The yield it earns goes to creators:{" "}
          <LiveNumber className="text-fg" value={sent} perSecond={(principal * apr) / YEAR} at={dataUpdatedAt} /> so far, without spending a cent
        </p>
      )}
      {notice && (
        <p className="text-[14px] text-pos" role="status">
          {notice}
        </p>
      )}
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : !rows || rows.length === 0 ? (
        <div className="surface px-6 py-10 text-center text-fg-2">
          You&apos;re not backing anyone yet.{" "}
          <Link href="/search" className="text-lamp hover:underline">
            Find someone
          </Link>
        </div>
      ) : (
        <ul className="surface divide-line overflow-hidden">
          {rows.map((r) => {
            const who = people.get(r.creator.toLowerCase());
            return (
              <li key={r.creator} className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <Link href={who ? `/u/${who.profile.username}` : `/u/${r.creator}`}>
                    <Avatar address={r.creator} src={who?.profile.avatar} name={who?.profile.username} size={40} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={who ? `/u/${who.profile.username}` : `/u/${r.creator}`} className="truncate font-medium hover:underline">
                      {who ? `@${who.profile.username}` : short(r.creator)}
                    </Link>
                    <div className="truncate text-[12px] text-muted">{badges(num(r.principal), r.since).join(" · ")}</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-[15px]">{money(num(r.principal))}</div>
                    <div className="text-[12px] text-muted">
                      sent <LiveNumber value={num(r.yieldGenerated)} perSecond={(num(r.principal) * apr) / YEAR} at={dataUpdatedAt} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 pl-[52px]">
                  <Withdraw creator={r.creator} principal={r.principal} onDone={setNotice} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** How a creator's income can grow, in real numbers. */
function Grow({ me }: { me: ProfileView }) {
  const { incomeApr } = useApr();
  const month = (usd: number) => money((usd * incomeApr) / 12);
  const total = num(me.principal);
  const ideas: [string, string][] = [
    ["5 more backers at $100", `+${month(500)} a month`],
    ["20 more backers at $50", `+${month(1000)} a month`],
    ["One backer at $5,000", `+${month(5000)} a month`],
  ];
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[17px] font-medium">Grow your income</h2>
      <div className="surface p-5">
        <p className="text-[15px] text-fg-2">
          Right now <span className="num text-fg">{money(total)}</span> backs you, about <span className="num text-fg">{month(total)}</span> a month. Every $1,000 of backing adds
          about <span className="num text-fg">{month(1000)}</span> a month
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ideas.map(([k, v]) => (
            <li key={k} className="rounded-[12px] bg-raised px-4 py-3">
              <div className="text-[13px] text-fg-2">{k}</div>
              <div className="num mt-1 text-[16px] text-lamp">{v}</div>
            </li>
          ))}
        </ul>
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <div className="text-[15px] font-medium">Share your profile</div>
          <p className="mt-1 text-[14px] text-fg-2">
            Backers find you through people they trust. Your link has brought <span className="num text-fg">{Number(me.referred)}</span> backer{Number(me.referred) === 1 ? "" : "s"} so far
          </p>
          <div className="mt-3">
            <Invite username={me.profile.username} text="Back me on Backing. Your USDC stays yours, its yield supports my work" />
          </div>
        </div>
        <ul className="mt-5 flex list-disc flex-col gap-1 pl-5 text-[14px] text-fg-2">
          <li>Post what you&apos;re making. Your backers see it in &ldquo;People I back&rdquo;</li>
          <li>Thank new backers. The ones who stay earn loyalty badges on your profile</li>
          <li>Ask your top backers to share your link. Their invites show up as &ldquo;Brought&rdquo;</li>
        </ul>
      </div>
    </section>
  );
}
