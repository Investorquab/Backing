"use client";
import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { MessageSquareQuote, X } from "lucide-react";
import { backingAbi, mockUsdcAbi } from "@/lib/abi";
import { useApr, usePosition, useTx, type CreatorView } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { useMiniApp } from "@/lib/miniapp";
import { ago, money, num, parseCastHash, toUnits, ZERO_CAST } from "@/lib/format";
import { LiveNumber, TxStatus } from "./ui";
import { ShareRow, profileUrl } from "./ShareRow";
import { WithdrawControl } from "./WithdrawControl";
import { SignIn } from "./SignIn";
import { tierOf } from "./TheBlock";

const YEAR = 365 * 24 * 3600;

export function BackPanel({ creator }: { creator: CreatorView }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { address, isConnected } = useAccount();
  const { apr, incomeApr, demo } = useApr();
  const mini = useMiniApp();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [castHash, setCastHash] = useState<`0x${string}` | null>(null);
  const [justBacked, setJustBacked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const tx = useTx();
  const pos = usePosition(address, creator.creator);

  // A backing remembers the cast that led to it: from Base App's launch context, or ?cast= on the web.
  useEffect(() => {
    if (mini.cast) setCastHash(mini.cast.hash);
    else setCastHash(parseCastHash(new URLSearchParams(window.location.search).get("cast")));
  }, [mini.cast]);

  const bal = useReadContract({
    chainId: net.chain.id,
    address: d.usdc,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8000 },
  });
  const allowance = useReadContract({
    chainId: net.chain.id,
    address: d.usdc,
    abi: mockUsdcAbi,
    functionName: "allowance",
    args: address ? [address, d.backing] : undefined,
    query: { enabled: !!address },
  });

  const isSelf = address?.toLowerCase() === creator.creator.toLowerCase();
  const units = toUnits(amount);
  const balance = (bal.data as bigint | undefined) ?? 0n;
  const tooMuch = units !== null && units > balance;
  const tooSmall = units !== null && units < 1_000_000n;
  const noteBytes = new TextEncoder().encode(note).length;
  const valid = units !== null && !tooMuch && !tooSmall && noteBytes <= 140;
  const monthly = ((units ? num(units) : 0) * incomeApr) / 12;
  const myPrincipal = pos.data?.principal ?? 0n;
  const hasPosition = myPrincipal > 0n;

  async function onBack() {
    if (!units) return;
    const steps = [];
    if (((allowance.data as bigint | undefined) ?? 0n) < units) {
      steps.push({
        label: `Approve ${net.symbol}`,
        run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.usdc, abi: mockUsdcAbi, functionName: "approve", args: [d.backing, units] }),
      });
    }
    steps.push({
      label: `Back ${creator.name}`,
      run: () =>
        tx.writeContractAsync({
          chainId: net.chain.id,
          address: d.backing,
          abi: backingAbi,
          functionName: "back",
          args: [creator.creator, units, castHash ?? ZERO_CAST, note.trim()],
        }),
    });
    const ok = await tx.send(steps, `You're backing ${creator.name}. Your ${money(num(units))} is working for them now`);
    if (ok) {
      setAmount("");
      setNote("");
      setJustBacked(true);
    }
  }

  if (isSelf) {
    return (
      <div className="surface p-5">
        <h3 className="text-[17px] font-medium">This is you</h3>
        <p className="mt-1 text-[14px] text-fg-2">You can&apos;t back yourself. Share your profile so others can</p>
        <div className="mt-4">
          <ShareRow address={creator.creator} name={creator.name} mine />
        </div>
      </div>
    );
  }

  return (
    <div className="surface flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-[17px] font-medium">{hasPosition ? "Add to your backing" : `Back ${creator.name}`}</h3>
        <p className="mt-1 text-[14px] text-fg-2">Your {net.symbol} stays yours. Only the yield it earns goes to them</p>
      </div>

      {castHash && (
        <div className="flex items-start gap-3 rounded-[10px] bg-raised p-3 text-[14px]">
          <MessageSquareQuote size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-fg-2" />
          <div className="min-w-0 flex-1">
            <div className="text-fg">Backing from a cast{mini.cast?.author.username ? ` by @${mini.cast.author.username}` : ""}</div>
            {mini.cast?.text ? <p className="mt-1 line-clamp-2 text-fg-2">{mini.cast.text}</p> : <p className="num mt-1 text-[12px] text-muted">{castHash.slice(0, 12)}…</p>}
          </div>
          <button
            className="text-muted hover:text-fg"
            aria-label="Don't link this cast"
            onClick={() => {
              setCastHash(null);
              mini.clearCast();
            }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {!isConnected ? (
        <div className="flex flex-col gap-3 rounded-[10px] bg-raised p-4 text-[14px] text-fg-2">
          Sign in to back {creator.name}
          <SignIn big />
        </div>
      ) : (
        <>
          <div>
            <div className="mb-2 flex justify-between text-[13px] text-fg-2">
              <label htmlFor="amount">Amount</label>
              <button className="num text-[12px] text-muted hover:text-fg" onClick={() => setAmount(String(num(balance)))}>
                Balance {money(num(balance))}
              </button>
            </div>
            <div className="relative">
              <input id="amount" className="input num h-12 pr-16 text-[18px]" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">{net.symbol}</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[10, 50, 100, 500].map((v) => (
                <button key={v} className="btn btn-secondary btn-sm num" onClick={() => setAmount(String(v))}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-[13px] text-fg-2">
              <label htmlFor="note">Note to {creator.name}, optional</label>
              <span className={`num text-[12px] ${noteBytes > 140 ? "text-neg" : "text-muted"}`}>{noteBytes}/140</span>
            </div>
            <input id="note" className="input" placeholder="Say why. It shows in the feed" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <dl className="divide-line rounded-[10px] bg-raised px-4 text-[14px]">
            <div className="flex justify-between py-2">
              <dt className="text-fg-2">They receive about</dt>
              <dd className="num">{money(monthly)} a month</dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-fg-2">You can withdraw</dt>
              <dd className="text-right">All of it, any time</dd>
            </div>
          </dl>
          {demo && <p className="-mt-2 text-[12px] text-muted">Estimate at a real-world {Math.round(incomeApr * 100)}% a year. The demo vault runs faster</p>}

          {tooMuch && <p className="text-[14px] text-neg">Not enough {net.symbol}{d.demo ? ". Use the test USDC button at the top" : ""}</p>}
          {tooSmall && <p className="text-[14px] text-neg">The minimum is 1 {net.symbol}</p>}

          <button className="btn btn-primary btn-lg w-full" disabled={!valid || tx.state.status === "pending"} onClick={onBack}>
            {tx.state.status === "pending" ? "Working" : hasPosition ? "Add to backing" : `Back ${creator.name}`}
          </button>
          <TxStatus state={tx.state} />

          {justBacked && mini.inMiniApp && (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => mini.composeCast(`I just backed ${creator.name} on Backing. My USDC stays mine, the yield goes to them`, profileUrl(creator.creator, net.key))}>
                Cast that you backed them
              </button>
              <button className="btn btn-quiet btn-sm" onClick={() => mini.addApp()}>
                Add Backing to your apps
              </button>
            </div>
          )}
        </>
      )}

      {notice && !hasPosition && (
        <p className="text-[14px] text-pos" role="status">
          {notice}
        </p>
      )}

      {hasPosition && pos.data && (
        <div className="border-t border-[var(--line)] pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-medium">Your backing</span>
            <span className="num text-[12px] text-muted">
              {tierOf(num(myPrincipal)).name} · {ago(pos.data.since)}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[13px] text-fg-2">Principal, yours</dt>
              <dd className="num mt-1 text-[18px]">{money(num(myPrincipal))}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-fg-2">Yield you&apos;ve sent</dt>
              <dd className="mt-1 text-[18px]">
                <LiveNumber value={num(pos.data.yieldGenerated)} perSecond={(num(myPrincipal) * apr) / YEAR} at={pos.dataUpdatedAt} />
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <WithdrawControl creator={creator.creator} principal={myPrincipal} onDone={setNotice} />
          </div>
          <div className="mt-4 rounded-[10px] bg-raised p-4">
            <div className="mb-3 text-[14px]">Ask a friend to back {creator.name} too</div>
            <ShareRow address={creator.creator} name={creator.name} />
          </div>
        </div>
      )}
    </div>
  );
}
