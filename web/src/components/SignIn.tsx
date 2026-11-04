"use client";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { LogOut } from "lucide-react";
import { short } from "@/lib/format";
import { useMiniApp } from "@/lib/miniapp";
import { Avatar } from "./Avatar";

const OPTIONS: Record<string, { name: string; hint: string }> = {
  baseAccount: { name: "Base Account", hint: "Face ID or fingerprint. No extension needed" },
  injected: { name: "Browser wallet", hint: "MetaMask, Rabby, Coinbase Wallet" },
  walletConnect: { name: "WalletConnect", hint: "Scan with a wallet on your phone" },
};

/** Your wallet is your account: signing in = connecting it. Inside Base App this happens by itself. */
export function SignIn({ big = false }: { big?: boolean }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const mini = useMiniApp();
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

  const cls = big ? "btn btn-primary btn-lg" : "btn btn-primary btn-sm";
  if (!mounted) return <button className={cls}>Sign in</button>;

  if (isConnected && address) {
    if (big) return null;
    return (
      <div className="relative" ref={ref}>
        <button className="btn btn-secondary btn-sm gap-2 pl-2" onClick={() => setOpen((o) => !o)}>
          <Avatar address={address} src={mini.user?.pfpUrl} name={mini.user?.displayName} size={20} />
          <span className="num text-[13px]">{mini.user?.username ? `@${mini.user.username}` : short(address)}</span>
        </button>
        {open && (
          <div className="surface absolute right-0 top-10 z-40 w-56 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
            <div className="num px-3 py-2 text-[12px] text-muted">{short(address)}</div>
            {!mini.inMiniApp && (
              <button className="flex h-9 w-full items-center gap-2 rounded-[8px] px-3 text-left text-[14px] text-fg-2 hover:bg-raised hover:text-fg" onClick={() => disconnect()}>
                <LogOut size={16} strokeWidth={1.5} /> Sign out
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const choices = connectors.filter((c) => c.id !== "farcaster");
  return (
    <div className="relative" ref={ref}>
      <button className={cls} onClick={() => setOpen((o) => !o)} disabled={isPending}>
        {isPending ? "Signing in" : "Sign in"}
      </button>
      {open && (
        <div className={`surface absolute z-40 w-72 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${big ? "left-0 top-14" : "right-0 top-10"}`}>
          <p className="px-3 pb-1 pt-2 text-[13px] text-muted">Your wallet is your account. No password, no email</p>
          {choices.map((c) => {
            const o = OPTIONS[c.type] ?? OPTIONS[c.id] ?? { name: c.name, hint: "" };
            const name = c.type === "injected" && c.name !== "Injected" ? c.name : o.name;
            return (
              <button key={c.uid} className="w-full rounded-[10px] px-3 py-2 text-left hover:bg-raised" onClick={() => connect({ connector: c })}>
                <div className="text-[15px] font-medium">{name}</div>
                {o.hint && <div className="text-[13px] text-muted">{o.hint}</div>}
              </button>
            );
          })}
          {error && <p className="px-3 py-2 text-[13px] text-neg">{error.message.split("\n")[0]}</p>}
        </div>
      )}
    </div>
  );
}
