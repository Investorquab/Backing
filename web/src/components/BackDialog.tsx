"use client";
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { backingAbi, mockUsdcAbi } from "@/lib/abi";
import { useApr, usePosition, useProfile, useTx, ZERO } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { useUi } from "@/lib/ui-state";
import { storedRef } from "@/lib/invite";
import { badges, money, num, toUnits } from "@/lib/format";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { SignIn } from "./SignIn";
import { Invite } from "./Invite";
import { Withdraw } from "./Withdraw";
import { LiveNumber, Skeleton, TxStatus } from "./ui";

const YEAR = 365 * 24 * 3600;

export function BackDialog() {
  const ui = useUi();
  const t = ui.backTarget;
  const { data: c, missing } = useProfile(t?.creator);
  return (
    <Modal open={!!t} onClose={ui.closeBack} title={c ? `Back @${c.profile.username}` : "Back"}>
      {t && c && <BackForm key={t.creator} creator={c.account} username={c.profile.username} avatar={c.profile.avatar} />}
      {t && !c &&
        (missing ? (
          <p className="text-fg-2">This profile isn&apos;t available.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-24" />
          </div>
        ))}
    </Modal>
  );
}

function BackForm({ creator, username, avatar }: { creator: `0x${string}`; username: string; avatar: string }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { address, isConnected } = useAccount();
  const { apr, incomeApr, demo } = useApr();
  const tx = useTx();
  const pos = usePosition(address, creator);
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const bal = useReadContract({
    chainId: net.chain.id,
    address: d.usdc,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8000 },
  });
  const allowance = useReadContract({
    chainId: net.chain.id,
    address: d.usdc,
    abi: mockUsdcAbi,
    functionName: "allowance",
    args: address ? [address, d.backing] : undefined,
    query: { enabled: !!address },
  });

  const units = toUnits(amount);
  const balance = (bal.data as bigint | undefined) ?? 0n;
  const tooMuch = units !== null && units > balance;
  const tooSmall = units !== null && units < 1_000_000n;
  const valid = units !== null && !tooMuch && !tooSmall;
  const monthly = ((units ? num(units) : 0) * incomeApr) / 12;
  const p = pos.data;
  const backing = !!p && p.principal > 0n;

  if (address?.toLowerCase() === creator.toLowerCase()) return <p className="text-fg-2">This is you. Share your profile so others can back you</p>;

  async function onBack() {
    if (!units) return;
    const ref = storedRef();
    const steps = [];
    if (((allowance.data as bigint | undefined) ?? 0n) < units) {
      steps.push({
        label: `Approve ${net.symbol}`,
        run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.usdc, abi: mockUsdcAbi, functionName: "approve", args: [d.backing, units] }),
      });
    }
    steps.push({
      label: `Back @${username}`,
      run: () =>
        tx.writeContractAsync({
          chainId: net.chain.id,
          address: d.backing,
          abi: backingAbi,
          functionName: "back",
          args: [creator, units, ref && ref.toLowerCase() !== address?.toLowerCase() ? ref : ZERO],
        }),
    });
    const msg = `You're backing @${username}. Your ${money(num(units))} stays yours`;
    if (await tx.send(steps, msg)) {
      setDone(msg);
      setAmount("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar address={creator} src={avatar} name={username} size={40} />
        <p className="text-[14px] text-fg-2">Your {net.symbol} stays yours and you can take it back any time. Only the yield it earns goes to @{username}</p>
      </div>

      {done ? (
        <div className="flex flex-col gap-3 rounded-[12px] bg-raised p-4">
          <p className="text-[15px] text-pos" role="status">
            {done}
          </p>
          <p className="text-[14px] text-fg-2">Back them too: invite a friend. Anyone who backs through your link is counted as yours</p>
          <Invite username={username} text={`I'm backing @${username} on Backing. My USDC stays mine, the yield goes to them. Back them too`} />
        </div>
      ) : !isConnected ? (
        <div className="flex flex-col items-start gap-3 rounded-[12px] bg-raised p-4 text-[14px] text-fg-2">
          Connect a wallet to back @{username}
          <SignIn big />
        </div>
      ) : (
        <>
          <div>
            <div className="mb-2 flex justify-between text-[13px] text-fg-2">
              <label htmlFor="amount">Amount</label>
              <button className="num text-[12px] text-muted hover:text-fg" onClick={() => setAmount(String(num(balance)))}>
                Balance {money(num(balance))}
              </button>
            </div>
            <div className="relative">
              <input id="amount" autoFocus className="input num h-14 pr-16 text-[22px]" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-muted">{net.symbol}</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[10, 50, 100, 500].map((v) => (
                <button key={v} className="btn btn-secondary btn-sm num" onClick={() => setAmount(String(v))}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <dl className="divide-line rounded-[12px] bg-raised px-4 text-[14px]">
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-fg-2">@{username} receives about</dt>
              <dd className="num">{money(monthly)} a month</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-fg-2">You can withdraw</dt>
              <dd>All of it, any time</dd>
            </div>
          </dl>
          {demo && <p className="-mt-2 text-[12px] text-muted">Estimate at a real-world {Math.round(incomeApr * 100)}% a year. The demo vault runs faster</p>}
          {tooMuch && <p className="text-[14px] text-neg">Not enough {net.symbol}{d.demo ? ". Get test USDC on the Feed" : ""}</p>}
          {tooSmall && <p className="text-[14px] text-neg">The minimum is 1 {net.symbol}</p>}
          <button className="btn btn-primary btn-lg w-full" disabled={!valid || tx.state.status === "pending"} onClick={onBack}>
            {tx.state.status === "pending" ? "Working" : backing ? "Add to backing" : `Back @${username}`}
          </button>
          <TxStatus state={tx.state} />
        </>
      )}

      {backing && p && (
        <div className="border-t border-[var(--line)] pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-medium">Your backing</span>
            <span className="text-[12px] text-muted">{badges(num(p.principal), p.since).join(" · ")}</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[13px] text-fg-2">Yours</dt>
              <dd className="num mt-1 text-[18px]">{money(num(p.principal))}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-fg-2">Yield you&apos;ve sent</dt>
              <dd className="mt-1 text-[18px]">
                <LiveNumber value={num(p.yieldGenerated)} perSecond={(num(p.principal) * apr) / YEAR} at={pos.dataUpdatedAt} />
              </dd>
            </div>
          </dl>
          <div className="mt-3">
            <Withdraw creator={creator} principal={p.principal} />
          </div>
        </div>
      )}
    </div>
  );
}
