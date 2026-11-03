"use client";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { short } from "@/lib/format";
import { Avatar } from "./Avatar";

const LABELS: Record<string, { name: string; hint: string }> = {
  injected: { name: "Browser wallet", hint: "MetaMask, Rabby, Coinbase extension…" },
  baseAccount: { name: "Base Account", hint: "Smart wallet with a passkey, no extension needed" },
  walletConnect: { name: "WalletConnect", hint: "Scan with a mobile wallet" },
};

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    if (isConnected) setOpen(false);
  }, [isConnected]);

  if (!mounted) return <button className="btn btn-lamp px-4 py-2 text-sm">Connect</button>;

  return (
    <div className="relative" ref={ref}>
      {isConnected && address ? (
        <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => setOpen((o) => !o)}>
          <Avatar address={address} size={20} />
          <span className="num">{short(address)}</span>
        </button>
      ) : (
        <button className="btn btn-lamp px-4 py-2 text-sm" onClick={() => setOpen((o) => !o)} disabled={isPending}>
          {isPending ? "Connecting…" : "Connect"}
        </button>
      )}
      {open && (
        <div className="card absolute right-0 top-12 z-40 w-72 p-2 shadow-2xl">
          {isConnected ? (
            <button className="w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-panel-2" onClick={() => disconnect()}>
              Disconnect
            </button>
          ) : (
            <>
              {connectors.map((c) => {
                const l = LABELS[c.type] ?? LABELS[c.id] ?? { name: c.name, hint: "" };
                const name = c.type === "injected" && c.name !== "Injected" ? c.name : l.name;
                return (
                  <button
                    key={c.uid}
                    className="w-full rounded-xl px-3 py-3 text-left hover:bg-panel-2"
                    onClick={() => connect({ connector: c })}
                  >
                    <div className="text-sm font-medium">{name}</div>
                    {l.hint && <div className="text-xs text-dim">{l.hint}</div>}
                  </button>
                );
              })}
              {error && <p className="px-3 py-2 text-xs text-bad">{error.message.split("\n")[0]}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
