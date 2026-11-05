"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { backingAbi } from "@/lib/abi";
import { useApr, useTx, type PositionView } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { ago, dateLabel, money, num, terms, toUnits } from "@/lib/format";
import { LiveNumber, TxStatus, useNow } from "./ui";
import { tierOf } from "./TheBlock";

const YEAR = 365 * 24 * 3600;

/** Your stake in one creator: what's yours, what it has sent, and how to get it back. */
export function PositionControls({ p, at = 0, onDone }: { p: PositionView; at?: number; onDone?: (msg: string) => void }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { address } = useAccount();
  const { apr } = useApr();
  const tx = useTx();
  const now = useNow(1000);
  const t = terms(p.endsAt, p.lockedUntil, now);
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");
  const units = toUnits(amount);
  const busy = tx.state.status === "pending";
  const total = `${money(num(p.principal))} ${net.symbol}`;

  const run = async (label: string, fn: "unbackAll" | "unback" | "close", args: readonly unknown[], msg: string) => {
    const ok = await tx.send(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [{ label, run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: fn, args: args as any }) }],
      msg,
    );
    if (ok) {
      setAmount("");
      setPartial(false);
      onDone?.(msg);
    }
  };

  return (
    <div>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[13px] text-fg-2">Your principal</dt>
          <dd className="num mt-1 text-[18px]">{money(num(p.principal))}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-fg-2">Yield you&apos;ve sent</dt>
          <dd className="mt-1 text-[18px]">
            <LiveNumber value={num(p.yieldGenerated)} perSecond={t.ended || !at ? 0 : (num(p.principal) * apr) / YEAR} at={at} />
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[13px] text-muted">
        {tierOf(num(p.principal)).name} · since {ago(p.since)} ago · <span className={t.ended ? "text-lamp" : ""}>{t.label}</span>
        {t.locked && ` (until ${dateLabel(p.lockedUntil)})`}
      </p>

      <div className="mt-3">
        {t.ended ? (
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run("Close and withdraw", "close", [address, p.creator], `Ended. ${total} is back in your wallet`)}>
            Close and withdraw
          </button>
        ) : t.locked ? (
          <p className="text-[13px] text-fg-2">Locked. You can withdraw from {dateLabel(p.lockedUntil)}</p>
        ) : partial ? (
          <div className="flex gap-2">
            <input className="input num h-9" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} />
            <button
              className="btn btn-secondary btn-sm h-9"
              disabled={!units || units > p.principal || busy}
              onClick={() => units && run("Withdraw", "unback", [p.creator, units], `${money(num(units))} ${net.symbol} is back in your wallet`)}
            >
              Withdraw
            </button>
            <button className="btn btn-quiet btn-sm h-9" onClick={() => setPartial(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run("Withdraw all", "unbackAll", [p.creator], `${total} is back in your wallet`)}>
              Withdraw all
            </button>
            <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => setPartial(true)}>
              Withdraw some
            </button>
          </div>
        )}
      </div>
      <TxStatus state={tx.state} />
    </div>
  );
}
