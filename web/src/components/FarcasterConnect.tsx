"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { BadgeCheck, RefreshCw } from "lucide-react";
import { useFarcaster, useFarcasterUser } from "@/lib/farcaster";
import { short } from "@/lib/format";

/**
 * Shows whether this wallet is linked to a Farcaster account, and how to link it.
 * The link is trustless: it holds only when the wallet is a verified address on the Farcaster account,
 * so there's nothing to store and nobody can claim someone else's identity.
 */
export function FarcasterConnect() {
  const { address } = useAccount();
  const fc = useFarcaster(address);
  const [handle, setHandle] = useState("");
  const typed = handle.trim().replace(/^@/, "");
  const check = useFarcasterUser(typed.length >= 2 ? typed : undefined);
  const matches = !!check.data && !!address && check.data.addresses.includes(address.toLowerCase());

  if (!address) return null;
  const linked = fc.data;

  return (
    <div className="surface flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-medium">Farcaster</h2>
        <button className="btn btn-quiet btn-sm" onClick={() => fc.refetch()} disabled={fc.isFetching}>
          <RefreshCw size={14} strokeWidth={1.5} className={fc.isFetching ? "animate-spin" : ""} /> Check again
        </button>
      </div>

      {fc.isLoading ? (
        <div className="h-10 animate-pulse rounded-[10px] bg-raised" />
      ) : linked ? (
        <div className="flex items-start gap-2 text-[14px] text-pos">
          <BadgeCheck size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>
            Connected to <span className="font-medium">@{linked.username}</span> — your Farcaster posts show on your profile, with a verified badge
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-[14px] text-fg-2">
          <p>
            Your Farcaster posts appear here automatically once this wallet is a <span className="text-fg">verified address</span> on your Farcaster account. In your Farcaster app
            (Warpcast → Settings → Verified addresses), add <span className="num text-fg">{short(address)}</span>, then press <span className="text-fg">Check again</span>.
          </p>
          <div>
            <div className="mb-2 text-[13px]">Not sure? Check a handle against this wallet:</div>
            <input className="input" placeholder="yourhandle" value={handle} onChange={(e) => setHandle(e.target.value)} autoCapitalize="none" aria-label="Farcaster handle to check" />
            {typed.length >= 2 &&
              (check.isLoading ? (
                <p className="mt-2 text-[13px] text-muted">Checking…</p>
              ) : !check.data ? (
                <p className="mt-2 text-[13px] text-muted">No Farcaster user @{typed}</p>
              ) : matches ? (
                <p className="mt-2 text-[13px] text-pos">@{check.data.username} is verified on this wallet — press Check again and it&apos;ll link</p>
              ) : (
                <p className="mt-2 text-[13px]">@{check.data.username} hasn&apos;t verified this wallet. Add it in their Farcaster verified addresses first</p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
