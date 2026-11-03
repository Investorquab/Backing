"use client";
import { useEffect, useState } from "react";
import { useLive, type TxState } from "@/lib/hooks";
import { usd } from "@/lib/format";
import { useNet } from "@/lib/net";

export function LiveNumber({
  value,
  perSecond = 0,
  at = 0,
  className = "",
  prefix = "$",
}: {
  value: number;
  perSecond?: number;
  at?: number;
  className?: string;
  prefix?: string;
}) {
  const v = useLive(value, perSecond, at);
  return (
    <span className={`num ${className}`}>
      {prefix}
      {usd(v, { precise: perSecond > 0 })}
    </span>
  );
}

export function Stat({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-dim">{label}</div>
      <div className="mt-1 text-xl font-semibold sm:text-2xl">{children}</div>
      {hint && <div className="mt-1 text-xs text-dim">{hint}</div>}
    </div>
  );
}

export function TxStatus({ state }: { state: TxState }) {
  const { net } = useNet();
  if (state.status === "idle") return null;
  const color = state.status === "error" ? "text-bad" : state.status === "success" ? "text-ok" : "text-muted";
  return (
    <p className={`mt-3 text-sm ${color}`} role="status">
      {state.status === "pending" && <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-transparent align-[-2px]" />}
      {state.message}
      {state.hash && net.explorer && (
        <>
          {" "}
          <a className="underline decoration-dotted" href={`${net.explorer}/tx/${state.hash}`} target="_blank" rel="noreferrer">
            view tx
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

export function Badge({ principal }: { principal: number }) {
  const tier =
    principal >= 1000
      ? { label: "Night Owl", cls: "bg-moon/15 text-moon" }
      : principal >= 100
        ? { label: "Lamplighter", cls: "bg-lamp/15 text-lamp" }
        : { label: "Firefly", cls: "bg-ok/15 text-ok" };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tier.cls}`}>{tier.label}</span>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="text-lg font-semibold">{title}</div>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`card animate-pulse ${className}`} />;
}
