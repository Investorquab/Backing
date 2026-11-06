"use client";
import { useNet } from "@/lib/net";
import { AVAILABLE } from "@/lib/networks";

/** Switch between the networks that have a deployment (Testnet demo / Mainnet / Local). Hidden when there's only one. */
export function NetToggle() {
  const { net, setNet } = useNet();
  if (AVAILABLE.length < 2) return null;
  return (
    <div className="seg" role="group" aria-label="Network">
      {AVAILABLE.map((n) => (
        <button key={n.key} aria-pressed={net.key === n.key} onClick={() => setNet(n.key)} title={n.label}>
          {n.short}
        </button>
      ))}
    </div>
  );
}
