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
      className="rounded-full border border-line bg-panel-2 px-3 py-2 text-xs text-muted outline-none hover:text-fg"
    >
      {AVAILABLE.map((n) => (
        <option key={n.key} value={n.key}>
          {n.short}
        </option>
      ))}
    </select>
  );
}
