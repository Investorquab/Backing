"use client";
import { useAccount } from "wagmi";
import { BadgeCheck, RefreshCw } from "lucide-react";
import { useFarcaster, useFarcasterUser } from "@/lib/farcaster";
import { short } from "@/lib/format";

/**
 * Status of a creator's Farcaster link. Two ways to link:
 *  - type your handle above (self-declared): your casts show and fans can find you.
 *  - verify this wallet on Farcaster (trustless): adds the verified badge.
 */
export function FarcasterConnect({ handle }: { handle?: string }) {
  const { address } = useAccount();
  const byAddr = useFarcaster(address);
  const h = handle?.trim().replace(/^@/, "") || undefined;
  const byHandle = useFarcasterUser(byAddr.data ? undefined : h);

  if (!address) return null;
  const verified = byAddr.data;
  const linked = !verified && byHandle.data ? byHandle.data : null;
  const linkedVerified = !!linked && linked.addresses.includes(address.toLowerCase());

  return (
    <div className="surface flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-medium">Farcaster status</h2>
        <button className="btn btn-quiet btn-sm" onClick={() => byAddr.refetch()} disabled={byAddr.isFetching}>
          <RefreshCw size={14} strokeWidth={1.5} className={byAddr.isFetching ? "animate-spin" : ""} /> Check again
        </button>
      </div>

      {byAddr.isLoading ? (
        <div className="h-10 animate-pulse rounded-[10px] bg-raised" />
      ) : verified ? (
        <div className="flex items-start gap-2 text-[14px] text-pos">
          <BadgeCheck size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>
            Verified as <span className="font-medium">@{verified.username}</span>. This wallet is linked on Farcaster, so your casts and the verified badge show on your profile.
          </span>
        </div>
      ) : linked ? (
        linkedVerified ? (
          <div className="flex items-start gap-2 text-[14px] text-pos">
            <BadgeCheck size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span>
              <span className="font-medium">@{linked.username}</span> is verified on this wallet, so casts and the badge show on your profile.
            </span>
          </div>
        ) : (
          <div className="text-[14px] text-fg-2">
            Linked as <span className="font-medium text-fg">@{linked.username}</span>. Your casts show on your profile and fans can find you by handle. For the verified ✓ badge, add this
            wallet (<span className="num text-fg">{short(address)}</span>) as a verified address on Farcaster, then press Check again.
          </div>
        )
      ) : h ? (
        <div className="text-[14px] text-muted">No Farcaster user @{h}. Check the handle in the field above.</div>
      ) : (
        <div className="text-[14px] text-fg-2">
          Add your Farcaster username above to show your posts here and let fans find and back you. For the verified ✓ badge, also verify this wallet (
          <span className="num text-fg">{short(address)}</span>) on Farcaster.
        </div>
      )}
    </div>
  );
}
