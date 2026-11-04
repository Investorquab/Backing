"use client";
import { AVAILABLE } from "@/lib/networks";
import { useNet } from "@/lib/net";

export function NetworkSwitch() {
  const { net, setNet } = useNet();
  if (AVAILABLE.length < 2) return null;
  return (
    <select
      aria-label="Network"
      value={net.key}
      onChange={(e) => setNet(e.target.value as typeof net.key)}
      className="h-8 rounded-[8px] border border-[var(--line)] bg-card px-2 text-[13px] text-fg-2 outline-none hover:text-fg"
    >
      {AVAILABLE.map((n) => (
        <option key={n.key} value={n.key}>
          {n.short}
        </option>
      ))}
    </select>
  );
}
