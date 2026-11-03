"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { backingAbi } from "@/lib/abi";
import { useApr, useBackers, useCreator, useTx, type CreatorView } from "@/lib/hooks";
import { countdown, num, short, usd } from "@/lib/format";
import { useNet } from "@/lib/net";
import { Avatar } from "@/components/Avatar";
import { ShareRow, profileUrl } from "@/components/ShareRow";
import { Empty, LiveNumber, Skeleton, Stat, TxStatus, useNow } from "@/components/ui";

const YEAR = 365 * 24 * 3600;

export default function CreatorDashboard() {
  const { address, isConnected } = useAccount();
  const { data: c, isLoading, missing } = useCreator(address);

  if (!isConnected)
    return (
      <Empty title="Creators: get backed, not tipped">
        Connect the wallet you want to receive income with. Fans stake USDC behind you; you claim the yield every epoch.
      </Empty>
    );
  if (isLoading) return <Skeleton className="h-64" />;
  if (missing || !c) return <ProfileForm />;
  return <Dashboard c={c} />;
}

function Dashboard({ c }: { c: CreatorView }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { apr, incomeApr, demo } = useApr();
  const { dataUpdatedAt } = useCreator(c.creator);
  const { rows } = useBackers(c.creator);
  const tx = useTx();
  const now = useNow();
  const [editing, setEditing] = useState(false);

  const p = num(c.principal);
  const perSec = (p * apr) / YEAR;
  const wait = Number(c.nextClaimAt) - now;
  const canClaim = wait <= 0 && c.claimable > 0n;
  const unit = (n: number, w: string) => (n === 1 ? w : `${n} ${w}s`);
  const epochLabel =
    d.epochSeconds >= 86400 ? unit(d.epochSeconds / 86400, "day") : d.epochSeconds >= 3600 ? unit(d.epochSeconds / 3600, "hour") : unit(Math.round(d.epochSeconds / 60), "minute");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar address={c.creator} src={c.avatar} name={c.name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{c.name}</h1>
          <Link href={`/c/${c.creator}`} className="text-sm text-dim hover:text-fg">
            View public profile →
          </Link>
        </div>
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-dim">
          <span className="live-dot" /> Claimable now
        </div>
        <LiveNumber className="glow mt-2 block text-4xl font-bold text-lamp sm:text-5xl" value={num(c.claimable)} perSecond={perSec} at={dataUpdatedAt} />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="btn btn-lamp"
            disabled={!canClaim || tx.state.status === "pending"}
            onClick={() =>
              tx.send(
                [{ label: "Claim yield", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "claim" }) }],
                "Claimed. It's in your wallet.",
              )
            }
          >
            Claim to wallet
          </button>
          <span className="text-sm text-muted">
            {wait > 0 ? `Next claim in ${countdown(wait)}` : c.claimable > 0n ? "Ready to claim" : "Nothing to claim yet"} · claims open
            once every {epochLabel}
          </span>
        </div>
        <TxStatus state={tx.state} />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Backing">
          <span className="num">${usd(p)}</span>
        </Stat>
        <Stat label="Backers">
          <span className="num">{Number(c.backerCount)}</span>
        </Stat>
        <Stat label="Est. / month" hint={demo ? `at ${Math.round(incomeApr * 100)}% real APY` : undefined}>
          <span className="num text-ok">${usd((p * incomeApr) / 12)}</span>
        </Stat>
        <Stat label="Claimed all time">
          <span className="num">${usd(num(c.totalClaimed))}</span>
        </Stat>
      </section>

      <section className="card p-5">
        <div className="mb-1 font-semibold">Grow your backing</div>
        <p className="mb-4 text-sm text-muted">Every $1,000 backed sends you about ${usd((1000 * incomeApr) / 12)}/month at {demo ? `a real-world ${Math.round(incomeApr * 100)}% APY` : "today\u2019s rate"}. Share your link:</p>
        <div className="num mb-3 truncate rounded-xl bg-panel-2 px-3 py-2 text-xs text-muted">{profileUrl(c.creator, net.key)}</div>
        <ShareRow address={c.creator} name={c.name} text="Back me on Backing: your USDC stays yours, its yield supports my work." />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your backers</h2>
        {!rows || rows.length === 0 ? (
          <Empty title="No backers yet">Share your profile link to get your first backer.</Empty>
        ) : (
          <ul className="card divide-y divide-line">
            {rows.map((r) => (
              <li key={r.backer} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Avatar address={r.backer} size={28} />
                <span className="num flex-1">{short(r.backer)}</span>
                <span className="num text-xs text-ok">+${usd(num(r.generated))}</span>
                <span className="num w-24 text-right">${usd(num(r.principal))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        {editing ? (
          <ProfileForm existing={c} onDone={() => setEditing(false)} />
        ) : (
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        )}
      </section>
    </div>
  );
}

function ProfileForm({ existing, onDone }: { existing?: CreatorView; onDone?: () => void }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { address } = useAccount();
  const tx = useTx();
  const [f, setF] = useState({ name: "", bio: "", avatar: "", handle: "" });
  useEffect(() => {
    if (existing) setF({ name: existing.name, bio: existing.bio, avatar: existing.avatar, handle: existing.handle });
  }, [existing]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: k === "handle" ? e.target.value.replace(/^@/, "").trim() : e.target.value }));
  const enc = new TextEncoder();
  const valid =
    f.name.trim().length > 0 &&
    enc.encode(f.name).length <= 48 &&
    enc.encode(f.bio).length <= 280 &&
    enc.encode(f.avatar).length <= 256 &&
    enc.encode(f.handle).length <= 32 &&
    (!f.avatar || /^https:\/\//.test(f.avatar));

  async function submit() {
    const args = [f.name.trim(), f.bio.trim(), f.avatar.trim(), f.handle] as const;
    const ok = await tx.send(
      [
        {
          label: existing ? "Update profile" : "Create profile",
          run: () =>
            tx.writeContractAsync({
              chainId: net.chain.id,
              address: d.backing,
              abi: backingAbi,
              functionName: existing ? "updateProfile" : "registerCreator",
              args,
            }),
        },
      ],
      existing ? "Profile updated" : "You're live. Share your link to get backed.",
    );
    if (ok) onDone?.();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="card flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{existing ? "Edit profile" : "Set up your creator profile"}</h1>
          {!existing && (
            <p className="mt-1 text-sm text-muted">
              Fans back you with USDC that stays theirs. You get the yield, claimable every epoch. Your profile is stored on-chain on{" "}
              {net.chain.name}.
            </p>
          )}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Name *</span>
          <input className="input" maxLength={48} value={f.name} onChange={set("name")} placeholder="Nocturne Beats" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex justify-between text-muted">
            Bio <span className="num text-dim">{f.bio.length}/280</span>
          </span>
          <textarea className="input min-h-24" maxLength={280} value={f.bio} onChange={set("bio")} placeholder="What do you make, and what will backing help you do?" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Avatar image URL (https)</span>
          <input className="input" value={f.avatar} onChange={set("avatar")} placeholder="https://…" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">X handle</span>
          <input className="input" value={f.handle} onChange={set("handle")} placeholder="yourhandle" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-lamp" disabled={!valid || tx.state.status === "pending"} onClick={submit}>
            {existing ? "Save changes" : "Create profile"}
          </button>
          {onDone && (
            <button className="btn btn-ghost" onClick={onDone}>
              Cancel
            </button>
          )}
        </div>
        <TxStatus state={tx.state} />
      </div>
      <div>
        <div className="mb-2 text-xs uppercase tracking-wider text-dim">Preview</div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <Avatar address={address ?? "0x0"} src={f.avatar} name={f.name || "?"} size={52} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{f.name || "Your name"}</div>
              {f.handle && <div className="text-xs text-dim">@{f.handle}</div>}
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm text-muted">{f.bio || "Your bio shows here."}</p>
        </div>
      </div>
    </div>
  );
}
