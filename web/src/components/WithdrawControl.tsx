"use client";
import { useState } from "react";
import { backingAbi } from "@/lib/abi";
import { useTx } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { money, num, toUnits } from "@/lib/format";
import { TxStatus } from "./ui";

/** `onDone` lets the page keep the confirmation visible after a full withdrawal removes this row. */
export function WithdrawControl({ creator, principal, onDone }: { creator: `0x${string}`; principal: bigint; onDone?: (message: string) => void }) {
  const { net } = useNet();
  const d = net.deployment!;
  const tx = useTx();
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");
  const units = toUnits(amount);
  const busy = tx.state.status === "pending";

  const all = async () => {
    const msg = `${money(num(principal))} ${net.symbol} is back in your wallet`;
    const ok = await tx.send(
      [{ label: "Withdraw all", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "unbackAll", args: [creator] }) }],
      msg,
    );
    if (ok) onDone?.(msg);
  };
  const some = async () => {
    if (!units) return;
    const msg = `${money(num(units))} ${net.symbol} is back in your wallet`;
    const ok = await tx.send(
      [{ label: "Withdraw", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "unback", args: [creator, units] }) }],
      msg,
    );
    if (ok) {
      setAmount("");
      onDone?.(msg);
    }
  };

  return (
    <div>
      {partial ? (
        <div className="flex gap-2">
          <input className="input num h-9" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} />
          <button className="btn btn-secondary btn-sm h-9" disabled={!units || units > principal || busy} onClick={some}>
            Withdraw
          </button>
          <button className="btn btn-quiet btn-sm h-9" onClick={() => setPartial(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={all}>
            Withdraw all
          </button>
          <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => setPartial(true)}>
            Withdraw some
          </button>
        </div>
      )}
      <TxStatus state={tx.state} />
    </div>
  );
}
