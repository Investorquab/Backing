"use client";
import { useState } from "react";
import { backingAbi } from "@/lib/abi";
import { useTx } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { num, toUnits, usd } from "@/lib/format";
import { TxStatus } from "./ui";

export function WithdrawControl({ creator, principal, compact = false }: { creator: `0x${string}`; principal: bigint; compact?: boolean }) {
  const { net } = useNet();
  const d = net.deployment!;
  const tx = useTx();
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");
  const units = toUnits(amount);
  const busy = tx.state.status === "pending";

  const all = () =>
    tx.send(
      [{ label: "Withdraw all", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "unbackAll", args: [creator] }) }],
      `Withdrawn: ${usd(num(principal))} ${net.symbol} is back in your wallet.`,
    );
  const some = async () => {
    if (!units) return;
    const ok = await tx.send(
      [{ label: "Withdraw", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "unback", args: [creator, units] }) }],
      `Withdrawn: ${usd(num(units))} ${net.symbol} is back in your wallet.`,
    );
    if (ok) setAmount("");
  };

  return (
    <div>
      {partial ? (
        <div className="flex gap-2">
          <input className="input num py-2" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} />
          <button className="btn btn-ghost px-4 py-2 text-sm" disabled={!units || units > principal || busy} onClick={some}>
            Withdraw
          </button>
          <button className="px-2 text-sm text-dim hover:text-fg" onClick={() => setPartial(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className={`flex gap-2 ${compact ? "" : "flex-wrap"}`}>
          <button className="btn btn-ghost px-4 py-2 text-sm" disabled={busy} onClick={all}>
            Withdraw all
          </button>
          <button className="btn px-3 py-2 text-sm text-muted hover:text-fg" disabled={busy} onClick={() => setPartial(true)}>
            Withdraw some
          </button>
        </div>
      )}
      <TxStatus state={tx.state} />
    </div>
  );
}
