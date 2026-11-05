"use client";
import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { Lock, MessageSquareQuote, X } from "lucide-react";
import { backingAbi, mockUsdcAbi } from "@/lib/abi";
import { useApr, useCreator, usePosition, useTx } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { useMiniApp } from "@/lib/miniapp";
import { useUi } from "@/lib/ui-state";
import { DURATIONS, dateLabel, money, num, parseCastHash, toUnits, ZERO_CAST } from "@/lib/format";
import { xIntent } from "@/lib/x";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { SignIn } from "./SignIn";
import { TxStatus } from "./ui";
import { PositionControls } from "./PositionControls";
import { XGlyph } from "./XBits";

/** The Back dialog, opened from any post or profile. */
export function BackDialog() {
  const ui = useUi();
  const t = ui.backTarget;
  const { data: c } = useCreator(t?.creator);
  return (
    <Modal open={!!t} onClose={ui.closeBack} title={c ? `Back ${c.name}` : "Back"}>
      {t && c && <BackForm key={`${t.creator}-${t.post ?? 0}`} creator={c.creator} name={c.name} avatar={c.avatar} post={t.post} />}
    </Modal>
  );
}

function BackForm({ creator, name, avatar, post }: { creator: `0x${string}`; name: string; avatar: string; post?: bigint }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { address, isConnected } = useAccount();
  const { incomeApr, demo } = useApr();
  const mini = useMiniApp();
  const tx = useTx();
  const pos = usePosition(address, creator);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [secs, setSecs] = useState(0);
  const [lock, setLock] = useState(false);
  const [castHash, setCastHash] = useState<`0x${string}` | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (mini.cast) setCastHash(mini.cast.hash);
    else setCastHash(parseCastHash(new URLSearchParams(window.location.search).get("cast")));
  }, [mini.cast]);
  useEffect(() => {
    if (!secs) setLock(false);
  }, [secs]);

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

  const isSelf = address?.toLowerCase() === creator.toLowerCase();
  const units = toUnits(amount);
  const balance = (bal.data as bigint | undefined) ?? 0n;
  const tooMuch = units !== null && units > balance;
  const tooSmall = units !== null && units < 1_000_000n;
  const noteBytes = new TextEncoder().encode(note).length;
  const valid = units !== null && !tooMuch && !tooSmall && noteBytes <= 140;
  const monthly = ((units ? num(units) : 0) * incomeApr) / 12;
  const p = pos.data;
  const hasPosition = !!p && p.principal > 0n;
  const until = secs ? Math.floor(Date.now() / 1000) + secs : 0;
  const durLabel = DURATIONS.find((x) => x.secs === secs)?.label ?? "Ongoing";

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
      label: `Back ${name}`,
      run: () =>
        tx.writeContractAsync({
          chainId: net.chain.id,
          address: d.backing,
          abi: backingAbi,
          functionName: "back",
          args: [creator, units, { duration: BigInt(secs), lock, cast: castHash ?? ZERO_CAST, post: post ?? 0n, note: note.trim() }],
        }),
    });
    const msg = `You're backing ${name}. Your ${money(num(units))} is working for them now`;
    if (await tx.send(steps, msg)) {
      setDone(msg);
      setAmount("");
      setNote("");
    }
  }

  if (isSelf) return <p className="text-[15px] text-fg-2">This is you. You can&apos;t back yourself, but you can share your profile so others can</p>;

  const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/c/${creator}?net=${net.key}` : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar address={creator} src={avatar} name={name} size={40} />
        <p className="text-[14px] text-fg-2">Your {net.symbol} stays yours. Only the yield it earns goes to {name}</p>
      </div>

      {castHash && (
        <div className="flex items-start gap-3 rounded-[10px] bg-raised p-3 text-[14px]">
          <MessageSquareQuote size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-fg-2" />
          <div className="min-w-0 flex-1">
            <div>From a cast{mini.cast?.author.username ? ` by @${mini.cast.author.username}` : ""}</div>
            {mini.cast?.text && <p className="mt-1 line-clamp-2 text-fg-2">{mini.cast.text}</p>}
          </div>
          <button className="text-muted hover:text-fg" aria-label="Don't link this cast" onClick={() => (setCastHash(null), mini.clearCast())}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {done ? (
        <div className="flex flex-col gap-3">
          <p className="text-[15px] text-pos" role="status">
            {done}
          </p>
          <div className="flex flex-wrap gap-2">
            {mini.inMiniApp ? (
              <button className="btn btn-secondary btn-sm" onClick={() => mini.composeCast(`I just backed ${name} on Backing. My USDC stays mine, the yield goes to them`, profileUrl)}>
                Cast it
              </button>
            ) : (
              <a className="btn btn-secondary btn-sm" target="_blank" rel="noreferrer" href={xIntent(`I just backed ${name} on Backing. My USDC stays mine, the yield goes to them`, profileUrl)}>
                <XGlyph size={13} /> Share on X
              </a>
            )}
            <button className="btn btn-quiet btn-sm" onClick={() => setDone(null)}>
              Back more
            </button>
          </div>
        </div>
      ) : !isConnected ? (
        <div className="flex flex-col items-start gap-3 rounded-[10px] bg-raised p-4 text-[14px] text-fg-2">
          Sign in to back {name}
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
              <input id="amount" autoFocus className="input num h-12 pr-16 text-[18px]" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} />
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
            <div className="mb-2 text-[13px] text-fg-2">For how long</div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="For how long">
              {DURATIONS.map((x) => (
                <button key={x.label} role="radio" aria-checked={secs === x.secs} onClick={() => setSecs(x.secs)} className={`btn btn-sm ${secs === x.secs ? "btn-primary" : "btn-secondary"}`}>
                  {x.label}
                </button>
              ))}
            </div>
            {secs > 0 && (
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[10px] bg-raised p-3 text-[14px]">
                <input type="checkbox" className="mt-1 accent-[var(--color-lamp)]" checked={lock} onChange={(e) => setLock(e.target.checked)} />
                <span>
                  <span className="flex items-center gap-1.5 text-fg">
                    <Lock size={14} strokeWidth={1.5} /> Lock it for {durLabel.toLowerCase()}
                  </span>
                  <span className="text-fg-2">A stronger promise: you can&apos;t withdraw until {dateLabel(until)}. Without a lock you can leave any time</span>
                </span>
              </label>
            )}
          </div>

          <div>
            <div className="mb-2 flex justify-between text-[13px] text-fg-2">
              <label htmlFor="note">Note, optional</label>
              <span className={`num text-[12px] ${noteBytes > 140 ? "text-neg" : "text-muted"}`}>{noteBytes}/140</span>
            </div>
            <input id="note" className="input" placeholder="Say why. It shows on their profile" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <dl className="divide-line rounded-[10px] bg-raised px-4 text-[14px]">
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-fg-2">They receive about</dt>
              <dd className="num">{money(monthly)} a month</dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-fg-2">Ends</dt>
              <dd className="text-right">{secs ? `After ${durLabel.toLowerCase()}, ${dateLabel(until)}` : "When you withdraw"}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-fg-2">You can withdraw</dt>
              <dd className="text-right">{lock ? `All of it from ${dateLabel(until)}` : "All of it, any time"}</dd>
            </div>
          </dl>
          {demo && <p className="-mt-2 text-[12px] text-muted">Estimate at a real-world {Math.round(incomeApr * 100)}% a year. The demo vault runs faster</p>}
          {hasPosition && <p className="-mt-2 text-[12px] text-muted">Adding to your backing applies these terms to all of it. A lock is never shortened</p>}
          {tooMuch && <p className="text-[14px] text-neg">Not enough {net.symbol}{d.demo ? ". Get test USDC from the banner on Home" : ""}</p>}
          {tooSmall && <p className="text-[14px] text-neg">The minimum is 1 {net.symbol}</p>}

          <button className="btn btn-primary btn-lg w-full" disabled={!valid || tx.state.status === "pending"} onClick={onBack}>
            {tx.state.status === "pending" ? "Working" : hasPosition ? "Add to backing" : `Back ${name}`}
          </button>
          <TxStatus state={tx.state} />
        </>
      )}

      {hasPosition && p && (
        <div className="border-t border-[var(--line)] pt-4">
          <div className="mb-3 text-[15px] font-medium">Your backing</div>
          <PositionControls p={p} at={pos.dataUpdatedAt} />
        </div>
      )}
    </div>
  );
}
