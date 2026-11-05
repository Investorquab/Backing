"use client";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { LogIn, LogOut, MoreHorizontal } from "lucide-react";
import { short } from "@/lib/format";
import { useMiniApp } from "@/lib/miniapp";
import { useCreator } from "@/lib/hooks";
import { Avatar } from "./Avatar";

const OPTIONS: Record<string, { name: string; hint: string }> = {
  baseAccount: { name: "Base Account", hint: "Face ID or fingerprint. No extension needed" },
  injected: { name: "Browser wallet", hint: "MetaMask, Rabby, Coinbase Wallet" },
  walletConnect: { name: "WalletConnect", hint: "Scan with a wallet on your phone" },
};

/**
 * Your wallet is your account: signing in = connecting it. Inside Base App this happens by itself.
 * `wide` is the account switcher at the bottom of the sidebar, `big` a call-to-action button.
 */
export function SignIn({ big = false, wide = false }: { big?: boolean; wide?: boolean }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: me } = useCreator(address);
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

  const name = me?.name ?? mini.user?.displayName;
  const handle = me?.x ? `@${me.x}` : mini.user?.username ? `@${mini.user.username}` : address ? short(address) : "";
  const pic = me?.avatar || mini.user?.pfpUrl;
  const pop = wide ? "bottom-14 left-0" : big ? "left-0 top-14" : "right-0 top-10";

  if (!mounted)
    return wide ? <div className="h-14" /> : <button className={big ? "btn btn-primary btn-lg" : "btn btn-primary btn-sm"}>Sign in</button>;

  if (isConnected && address) {
    if (big) return null;
    return (
      <div className="relative" ref={ref}>
        {wide ? (
          <button className="flex h-14 w-full items-center gap-3 rounded-full px-2 transition-colors hover:bg-raised lg:px-3" onClick={() => setOpen((o) => !o)}>
            <Avatar address={address} src={pic} name={name} size={36} />
            <span className="hidden min-w-0 flex-1 text-left lg:block">
              <span className="block truncate text-[15px] font-medium">{name ?? "Your wallet"}</span>
              <span className="num block truncate text-[13px] text-muted">{handle}</span>
            </span>
            <MoreHorizontal size={18} strokeWidth={1.5} className="hidden text-muted lg:block" />
          </button>
        ) : (
          <button className="rounded-full" onClick={() => setOpen((o) => !o)} aria-label="Account">
            <Avatar address={address} src={pic} name={name} size={32} />
          </button>
        )}
        {open && (
          <div className={`surface absolute z-40 w-60 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${pop}`}>
            <div className="px-3 py-2">
              <div className="truncate text-[14px] font-medium">{name ?? "Signed in"}</div>
              <div className="num truncate text-[12px] text-muted">{short(address)}</div>
            </div>
            {!mini.inMiniApp && (
              <button className="flex h-10 w-full items-center gap-2 rounded-[8px] px-3 text-left text-[14px] text-fg-2 hover:bg-raised hover:text-fg" onClick={() => disconnect()}>
                <LogOut size={16} strokeWidth={1.5} /> Sign out
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const choices = connectors.filter((c) => c.id !== "farcaster");
  const label = isPending ? "Signing in" : "Sign in";
  return (
    <div className="relative" ref={ref}>
      {wide ? (
        <button className="btn btn-primary btn-lg w-12 px-0 lg:w-full" onClick={() => setOpen((o) => !o)} disabled={isPending} aria-label="Sign in">
          <LogIn size={18} strokeWidth={1.5} className="lg:hidden" />
          <span className="hidden lg:inline">{label}</span>
        </button>
      ) : (
        <button className={big ? "btn btn-primary btn-lg" : "btn btn-primary btn-sm"} onClick={() => setOpen((o) => !o)} disabled={isPending}>
          {label}
        </button>
      )}
      {open && (
        <div className={`surface absolute z-40 w-72 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${pop}`}>
          <p className="px-3 pb-1 pt-2 text-[13px] text-muted">Your wallet is your account. No password, no email</p>
          {choices.map((c) => {
            const o = OPTIONS[c.type] ?? OPTIONS[c.id] ?? { name: c.name, hint: "" };
            const n = c.type === "injected" && c.name !== "Injected" ? c.name : o.name;
            return (
              <button key={c.uid} className="w-full rounded-[10px] px-3 py-2 text-left hover:bg-raised" onClick={() => connect({ connector: c })}>
                <div className="text-[15px] font-medium">{n}</div>
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
