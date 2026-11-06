"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { LogOut, PieChart, UserRound, UserRoundPen } from "lucide-react";
import { short } from "@/lib/format";
import { useMiniApp } from "@/lib/miniapp";
import { useProfile } from "@/lib/hooks";
import { Avatar } from "./Avatar";
import { NetworkSwitch } from "./NetworkSwitch";

const OPTIONS: Record<string, { name: string; hint: string }> = {
  baseAccount: { name: "Base Account", hint: "Face ID or fingerprint. No extension needed" },
  injected: { name: "Browser wallet", hint: "MetaMask, Rabby, Coinbase Wallet" },
  walletConnect: { name: "WalletConnect", hint: "Scan with a wallet on your phone" },
};

/** Your wallet is your account. Inside Base App you're connected automatically. */
export function SignIn({ big = false }: { big?: boolean }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: me } = useProfile(address);
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

  const cls = big ? "btn btn-primary btn-lg" : "btn btn-primary btn-sm px-4";
  if (!mounted) return <button className={cls}>Connect wallet</button>;

  const item = "flex h-10 w-full items-center gap-3 rounded-[8px] px-3 text-left text-[14px] text-fg-2 hover:bg-raised hover:text-fg";

  if (isConnected && address) {
    if (big) return null;
    return (
      <div className="relative" ref={ref}>
        <button className="rounded-full" onClick={() => setOpen((o) => !o)} aria-label="Your account">
          <Avatar address={address} src={me?.profile.avatar || mini.user?.pfpUrl} name={me?.profile.username} size={36} />
        </button>
        {open && (
          <div className="surface absolute right-0 top-12 z-40 w-64 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]" onClick={() => setOpen(false)}>
            <div className="px-3 py-2">
              <div className="truncate text-[15px] font-medium">{me ? `@${me.profile.username}` : "No profile yet"}</div>
              <div className="num truncate text-[12px] text-muted">{short(address)}</div>
            </div>
            {me ? (
              <Link href={`/u/${me.profile.username}`} className={item}>
                <UserRound size={16} strokeWidth={1.5} /> My profile
              </Link>
            ) : null}
            <Link href="/profile/edit" className={item}>
              <UserRoundPen size={16} strokeWidth={1.5} /> {me ? "Edit profile" : "Create profile"}
            </Link>
            <Link href="/portfolio" className={item}>
              <PieChart size={16} strokeWidth={1.5} /> Portfolio
            </Link>
            <div className="flex items-center justify-between px-3 py-2 text-[14px] text-fg-2" onClick={(e) => e.stopPropagation()}>
              Network <NetworkSwitch />
            </div>
            {!mini.inMiniApp && (
              <button className={item} onClick={() => disconnect()}>
                <LogOut size={16} strokeWidth={1.5} /> Disconnect
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
        {isPending ? "Connecting" : "Connect wallet"}
      </button>
      {open && (
        <div className={`surface absolute z-40 w-72 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)] ${big ? "left-0 top-14" : "right-0 top-11"}`}>
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
          <div className="flex items-center justify-between px-3 py-2 text-[13px] text-muted">
            Network <NetworkSwitch />
          </div>
          {error && <p className="px-3 py-2 text-[13px] text-neg">{error.message.split("\n")[0]}</p>}
        </div>
      )}
    </div>
  );
}
