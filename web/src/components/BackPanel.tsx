"use client";
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { backingAbi, mockUsdcAbi } from "@/lib/abi";
import { useApr, usePosition, useTx, type CreatorView } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { num, since, toUnits, usd } from "@/lib/format";
import { LiveNumber, TxStatus } from "./ui";
import { ShareRow } from "./ShareRow";
import { WithdrawControl } from "./WithdrawControl";

const YEAR = 365 * 24 * 3600;

export function BackPanel({ creator }: { creator: CreatorView }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { address, isConnected } = useAccount();
  const { apr, incomeApr, demo } = useApr();
  const [amount, setAmount] = useState("");
  const tx = useTx();
  const pos = usePosition(address, creator.creator);
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

  const isSelf = address?.toLowerCase() === creator.creator.toLowerCase();
  const units = toUnits(amount);
  const balance = (bal.data as bigint | undefined) ?? 0n;
  const tooMuch = units !== null && units > balance;
  const tooSmall = units !== null && units < 1_000_000n;
  const valid = units !== null && !tooMuch && !tooSmall;
  const monthly = ((units ? num(units) : 0) * incomeApr) / 12;
  const myPrincipal = pos.data?.principal ?? 0n;
  const hasPosition = myPrincipal > 0n;

  async function onBack() {
    if (!units) return;
    const steps = [];
    if (((allowance.data as bigint | undefined) ?? 0n) < units) {
      steps.push({
        label: `Approve ${net.symbol}`,
        run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.usdc, abi: mockUsdcAbi, functionName: "approve", args: [d.backing, units] }),
      });
    }
    steps.push({
      label: `Back ${creator.name}`,
      run: () =>
        tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "back", args: [creator.creator, units] }),
    });
    const ok = await tx.send(steps, `You're backing ${creator.name}. Your ${usd(num(units))} ${net.symbol} is working for them now.`);
    if (ok) setAmount("");
  }

  if (isSelf) {
    return (
      <div className="card p-5 text-sm text-muted">
        This is your profile. You can&apos;t back yourself, but you can share your link so others can.
        <div className="mt-4">
          <ShareRow address={creator.creator} name={creator.name} text={`Back me on Backing: your USDC stays yours, its yield supports my work.`} />
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-lg font-semibold">{hasPosition ? "Top up your backing" : `Back ${creator.name}`}</h3>
        <p className="text-sm text-muted">Your {net.symbol} stays yours. Only the yield it earns goes to them.</p>
      </div>

      {!isConnected ? (
        <p className="rounded-xl bg-panel-2 p-4 text-sm text-muted">Connect a wallet (top right) to back this creator.</p>
      ) : (
        <>
          <div>
            <div className="mb-1 flex justify-between text-xs text-dim">
              <span>Amount</span>
              <button className="num hover:text-fg" onClick={() => setAmount(String(num(balance)))}>
                Balance: {usd(num(balance))} {net.symbol}
              </button>
            </div>
            <div className="relative">
              <input
                className="input num pr-20 text-lg"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(",", "."))}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-dim">{net.symbol}</span>
            </div>
            <div className="mt-2 flex gap-2">
              {[10, 50, 100, 500].map((v) => (
                <button key={v} className="btn btn-ghost flex-1 px-2 py-1.5 text-xs" onClick={() => setAmount(String(v))}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-panel-2 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Est. income you&apos;ll send them{demo ? ` (at ${Math.round(incomeApr * 100)}% APY)` : ""}</span>
              <span className="num text-ok">${usd(monthly)}/mo</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-muted">You can withdraw</span>
              <span className="text-right">100% of principal, any time</span>
            </div>
          </div>

          {tooMuch && <p className="text-sm text-bad">Not enough {net.symbol}.{d.demo ? " Use the test USDC button above." : ""}</p>}
          {tooSmall && <p className="text-sm text-bad">Minimum is 1 {net.symbol}.</p>}

          <button className="btn btn-lamp w-full" disabled={!valid || tx.state.status === "pending"} onClick={onBack}>
            {tx.state.status === "pending" ? "Working…" : hasPosition ? "Add to backing" : `Back ${creator.name}`}
          </button>
          <TxStatus state={tx.state} />
        </>
      )}

      {hasPosition && pos.data && (
        <div className="border-t border-line pt-4">
          <div className="mb-3 text-sm font-semibold">Your backing</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-dim">Principal (yours)</div>
              <div className="num text-lg">${usd(num(myPrincipal))}</div>
            </div>
            <div>
              <div className="text-xs text-dim">Yield you&apos;ve sent</div>
              <LiveNumber
                className="text-lg text-ok"
                value={num(pos.data.yieldGenerated)}
                perSecond={(num(myPrincipal) * apr) / YEAR}
                at={pos.dataUpdatedAt}
              />
            </div>
          </div>
          <div className="mt-1 text-xs text-dim">Backing for {since(pos.data.since)}</div>
          <div className="mt-4">
            <WithdrawControl creator={creator.creator} principal={myPrincipal} />
          </div>
          <div className="mt-5 rounded-xl bg-panel-2 p-4">
            <div className="mb-2 text-sm font-medium">Invite someone to back {creator.name} too</div>
            <ShareRow address={creator.creator} name={creator.name} />
          </div>
        </div>
      )}
    </div>
  );
}
