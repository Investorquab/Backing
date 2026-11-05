"use client";
import { useState } from "react";
import { backingAbi } from "@/lib/abi";
import { useTx } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { money, num, toUnits } from "@/lib/format";
import { TxStatus } from "./ui";

/** Take your capital back: all of it or some, any time. */
export function Withdraw({ creator, principal, onDone }: { creator: `0x${string}`; principal: bigint; onDone?: (msg: string) => void }) {
  const { net } = useNet();
  const d = net.deployment!;
  const tx = useTx();
  const [some, setSome] = useState(false);
  const [amount, setAmount] = useState("");
  const units = toUnits(amount);
  const busy = tx.state.status === "pending";

  const run = async (fn: "unbackAll" | "unback", args: readonly unknown[], value: bigint) => {
    const msg = `${money(num(value))} ${net.symbol} is back in your wallet`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = await tx.send([{ label: "Withdraw", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: fn, args: args as any }) }], msg);
    if (ok) {
      setAmount("");
      setSome(false);
      onDone?.(msg);
    }
  };

  return (
    <div>
      {some ? (
        <div className="flex gap-2">
          <input className="input num h-9" inputMode="decimal" aria-label="Amount to withdraw" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} />
          <button className="btn btn-secondary btn-sm h-9" disabled={!units || units > principal || busy} onClick={() => units && run("unback", [creator, units], units)}>
            Withdraw
          </button>
          <button className="btn btn-quiet btn-sm h-9" onClick={() => setSome(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run("unbackAll", [creator], principal)}>
            Withdraw all
          </button>
          <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => setSome(true)}>
            Withdraw some
          </button>
        </div>
      )}
      {/* the parent shows its own notice on success (the row may disappear) */}
      {!(onDone && tx.state.status === "success") && <TxStatus state={tx.state} />}
    </div>
  );
}
