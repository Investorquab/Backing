"use client";
import { money } from "@/lib/format";

export type Lit = { key: string; amount: number; label?: string };

/** One window per backer. Brighter windows hold more backing. Empty windows wait for the next backer. */
export function tierOf(amount: number) {
  if (amount >= 1000) return { name: "Night owl", level: 3 };
  if (amount >= 100) return { name: "Lamplighter", level: 2 };
  return { name: "Firefly", level: 1 };
}

const LEVEL_FILL = ["var(--color-raised)", "rgba(240,168,58,0.38)", "rgba(240,168,58,0.68)", "var(--color-lamp)"];

export function TheBlock({ lit, cols = 6, minRows = 4, className = "" }: { lit: Lit[]; cols?: number; minRows?: number; className?: string }) {
  const sorted = [...lit].sort((a, b) => b.amount - a.amount);
  const rows = Math.max(minRows, Math.ceil((sorted.length + 1) / cols));
  const total = rows * cols;
  // fill from the bottom floor up, brightest first, like a building lighting up at night
  const cells: (Lit | null)[] = Array.from({ length: total }, () => null);
  sorted.forEach((b, i) => {
    const row = rows - 1 - Math.floor(i / cols);
    const col = i % cols;
    cells[row * cols + col] = b;
  });
  return (
    <div className={className}>
      <div className="mx-auto h-2 w-[38%] rounded-t-[4px] bg-raised" aria-hidden />
      <div
        className="grid gap-[6px] rounded-t-[8px] border border-[var(--line)] bg-deep p-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${sorted.length} backer${sorted.length === 1 ? "" : "s"}, one lit window each`}
      >
        {cells.map((c, i) => (
          <div
            key={c?.key ?? `empty-${i}`}
            title={c ? `${c.label ?? ""} ${money(c.amount)} · ${tierOf(c.amount).name}`.trim() : undefined}
            className="aspect-[4/5] rounded-[3px]"
            style={{ background: LEVEL_FILL[c ? tierOf(c.amount).level : 0] }}
          />
        ))}
      </div>
    </div>
  );
}
