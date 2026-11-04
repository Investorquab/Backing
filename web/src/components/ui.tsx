"use client";
import { useEffect, useState } from "react";
import { useLive, type TxState } from "@/lib/hooks";
import { money } from "@/lib/format";
import { useNet } from "@/lib/net";

export function LiveNumber({ value, perSecond = 0, at = 0, className = "" }: { value: number; perSecond?: number; at?: number; className?: string }) {
  const v = useLive(value, perSecond, at);
  return <span className={`num ${className}`}>{money(v, { live: perSecond > 0 })}</span>;
}

export function Stat({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[13px] text-fg-2">{label}</div>
      <div className="num mt-1 text-[22px] font-medium leading-tight sm:text-[24px]">{children}</div>
      {note && <div className="mt-1 text-[12px] text-muted">{note}</div>}
    </div>
  );
}

/** A row of figures inside one surface, split by hairlines. */
export function StatRow({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const grid = cols === 4 ? "grid-cols-2 sm:grid-cols-4" : cols === 2 ? "grid-cols-2" : "grid-cols-3";
  return <div className={`surface grid ${grid} [&>*]:border-[var(--line)] [&>*+*]:border-l`}>{children}</div>;
}

export function TxStatus({ state }: { state: TxState }) {
  const { net } = useNet();
  if (state.status === "idle") return null;
  const color = state.status === "error" ? "text-neg" : state.status === "success" ? "text-pos" : "text-fg-2";
  return (
    <p className={`mt-3 text-[14px] ${color}`} role="status">
      {state.status === "pending" && (
        <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-transparent align-[-2px]" />
      )}
      {state.message}
      {state.hash && net.explorer && (
        <>
          {" · "}
          <a className="underline decoration-[var(--line-2)] underline-offset-2" href={`${net.explorer}/tx/${state.hash}`} target="_blank" rel="noreferrer">
            View transaction
          </a>
        </>
      )}
    </p>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="surface flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="text-[17px] font-medium">{title}</div>
      {children && <div className="max-w-md text-[14px] text-fg-2">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`surface animate-pulse ${className}`} />;
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[28px] font-medium leading-tight tracking-[-0.01em]">{title}</h1>
      {sub && <p className="mt-1 text-fg-2">{sub}</p>}
    </div>
  );
}
