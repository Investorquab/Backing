"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { backingAbi } from "@/lib/abi";
import { useApr, useBackers, useCreator, useCreatorMap, useTx, type CreatorView } from "@/lib/hooks";
import { countdown, money, num, short } from "@/lib/format";
import { useNet } from "@/lib/net";
import { useMiniApp } from "@/lib/miniapp";
import { Avatar } from "@/components/Avatar";
import { ShareRow, profileUrl } from "@/components/ShareRow";
import { SignIn } from "@/components/SignIn";
import { TheBlock, tierOf } from "@/components/TheBlock";
import { WindowMark } from "@/components/WindowMark";
import { Empty, LiveNumber, PageTitle, Skeleton, Stat, StatRow, TxStatus, useNow } from "@/components/ui";

const YEAR = 365 * 24 * 3600;
const bytes = (s: string) => new TextEncoder().encode(s).length;

export default function Studio() {
  const { address, isConnected } = useAccount();
  const { data: c, isLoading, missing } = useCreator(address);

  if (!isConnected)
    return (
      <div className="mx-auto max-w-3xl">
        <PageTitle title="Studio" sub="Get backed, not tipped" />
        <Empty title="Sign in with the wallet you want to be paid in">
          Fans stake USDC behind you. You collect the yield it earns, every epoch
          <div className="mt-4 flex justify-center">
            <SignIn big />
          </div>
        </Empty>
      </div>
    );
  if (isLoading) return <Skeleton className="h-64" />;
  if (missing || !c) return <ProfileForm />;
  return <Dashboard c={c} />;
}

function Dashboard({ c }: { c: CreatorView }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { apr, incomeApr } = useApr();
  const { dataUpdatedAt } = useCreator(c.creator);
  const { rows } = useBackers(c.creator);
  const creators = useCreatorMap();
  const tx = useTx();
  const now = useNow();
  const [editing, setEditing] = useState(false);

  const p = num(c.principal);
  const wait = Number(c.nextClaimAt) - now;
  const canClaim = wait <= 0 && c.claimable > 0n;
  const unit = (n: number, w: string) => (n === 1 ? w : `${n} ${w}s`);
  const epoch = d.epochSeconds >= 86400 ? unit(d.epochSeconds / 86400, "day") : d.epochSeconds >= 3600 ? unit(d.epochSeconds / 3600, "hour") : unit(Math.round(d.epochSeconds / 60), "minute");

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar address={c.creator} src={c.avatar} name={c.name} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[28px] font-medium leading-tight tracking-[-0.01em]">Studio</h1>
            <Link href={`/c/${c.creator}`} className="text-[14px] text-fg-2 hover:text-fg">
              {c.name} · view public profile
            </Link>
          </div>
        </div>

        <section className="surface p-5 sm:p-6">
          <div className="flex items-center gap-2 text-[13px] text-fg-2">
            <WindowMark size={12} /> Ready to claim
          </div>
          <LiveNumber className="mt-2 block text-[40px] font-medium leading-none text-lamp sm:text-[48px]" value={num(c.claimable)} perSecond={(p * apr) / YEAR} at={dataUpdatedAt} />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              className="btn btn-primary"
              disabled={!canClaim || tx.state.status === "pending"}
              onClick={() =>
                tx.send(
                  [{ label: "Claim yield", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "claim" }) }],
                  "Claimed. It's in your wallet",
                )
              }
            >
              Claim to wallet
            </button>
            <span className="text-[14px] text-fg-2">
              {wait > 0 ? `Next claim in ${countdown(wait)}` : c.claimable > 0n ? "You can claim now" : "Nothing to claim yet"} · claims open every {epoch}
            </span>
          </div>
          <TxStatus state={tx.state} />
        </section>

        <StatRow cols={4}>
          <Stat label="Backing">{money(p)}</Stat>
          <Stat label="Backers">{Number(c.backerCount)}</Stat>
          <Stat label="A month" note={`at ${Math.round(incomeApr * 100)}% a year`}>
            {money((p * incomeApr) / 12)}
          </Stat>
          <Stat label="Claimed so far">{money(num(c.totalClaimed))}</Stat>
        </StatRow>

        <Composer c={c} />

        <section>
          <h2 className="mb-3 text-[17px] font-medium">Your backers</h2>
          {!rows || rows.length === 0 ? (
            <Empty title="No backers yet">Share your profile to light the first window</Empty>
          ) : (
            <ul className="surface divide-line">
              {rows.map((r) => (
                <li key={r.backer} className="flex items-center gap-3 px-4 py-3 text-[14px]">
                  <Avatar address={r.backer} src={creators.get(r.backer.toLowerCase())?.avatar} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="num truncate">{creators.get(r.backer.toLowerCase())?.name ?? short(r.backer)}</div>
                    <div className="num text-[12px] text-muted">
                      {tierOf(num(r.principal)).name} · sent {money(num(r.generated))}
                    </div>
                  </div>
                  <span className="num">{money(num(r.principal))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>{editing ? <ProfileForm existing={c} onDone={() => setEditing(false)} /> : <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit profile</button>}</section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <div className="surface p-5">
          <div className="text-[15px] font-medium">Grow your block</div>
          <p className="mt-1 text-[14px] text-fg-2">
            Every $1,000 backed sends you about {money((1000 * incomeApr) / 12)} a month at {Math.round(incomeApr * 100)}% a year
          </p>
          <TheBlock className="mx-auto mt-4 w-[160px]" cols={4} minRows={5} lit={(rows ?? []).map((r) => ({ key: r.backer, amount: num(r.principal) }))} />
          <div className="num mt-4 truncate rounded-[8px] bg-raised px-3 py-2 text-[12px] text-fg-2">{profileUrl(c.creator, net.key)}</div>
          <div className="mt-3">
            <ShareRow address={c.creator} name={c.name} mine />
          </div>
        </div>
      </aside>
    </div>
  );
}

function Composer({ c }: { c: CreatorView }) {
  const { net } = useNet();
  const d = net.deployment!;
  const mini = useMiniApp();
  const tx = useTx();
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [posted, setPosted] = useState<string | null>(null);
  const n = bytes(text);
  const linkOk = !link || (/^https:\/\/\S+$/.test(link) && bytes(link) <= 256);
  const valid = text.trim().length > 0 && n <= 280 && linkOk;

  async function submit() {
    const body = text.trim();
    const ok = await tx.send(
      [{ label: "Post update", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "post", args: [body, link.trim()] }) }],
      "Posted to your backers' feeds",
    );
    if (ok) {
      setPosted(body);
      setText("");
      setLink("");
    }
  }

  return (
    <section className="surface p-5">
      <label htmlFor="update" className="text-[15px] font-medium">
        Post an update
      </label>
      <p className="mt-1 text-[14px] text-fg-2">It shows in the feed of everyone who backs you. Updates are stored on Base and can&apos;t be deleted</p>
      <textarea id="update" className="input mt-3 min-h-24" placeholder="What are you working on tonight" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input className="input" placeholder="Link, optional (https://…)" value={link} onChange={(e) => setLink(e.target.value.trim())} aria-label="Link" />
        <div className="flex items-center gap-3">
          <span className={`num text-[12px] ${n > 280 ? "text-neg" : "text-muted"}`}>{n}/280</span>
          <button className="btn btn-primary" disabled={!valid || tx.state.status === "pending"} onClick={submit}>
            Post
          </button>
        </div>
      </div>
      {!linkOk && <p className="mt-2 text-[13px] text-neg">Links start with https://</p>}
      <TxStatus state={tx.state} />
      {posted && mini.inMiniApp && (
        <button className="btn btn-secondary btn-sm mt-3" onClick={() => mini.composeCast(posted, profileUrl(c.creator, net.key))}>
          Also cast it
        </button>
      )}
    </section>
  );
}

function ProfileForm({ existing, onDone }: { existing?: CreatorView; onDone?: () => void }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { address } = useAccount();
  const mini = useMiniApp();
  const tx = useTx();
  const [f, setF] = useState({ name: "", bio: "", avatar: "", handle: "", fid: 0 });

  useEffect(() => {
    if (existing) setF({ name: existing.name, bio: existing.bio, avatar: existing.avatar, handle: existing.handle, fid: Number(existing.fid) });
  }, [existing]);

  // Inside Base App, start from the profile people already know.
  const fromApp = () => {
    const u = mini.user;
    if (!u) return;
    setF((s) => ({
      ...s,
      name: (u.displayName || u.username || s.name).slice(0, 48),
      handle: u.username ?? s.handle,
      avatar: u.pfpUrl && /^https:\/\//.test(u.pfpUrl) && bytes(u.pfpUrl) <= 256 ? u.pfpUrl : s.avatar,
      fid: u.fid,
    }));
  };
  useEffect(() => {
    if (!existing && mini.user) fromApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mini.user, existing]);

  const set = (k: "name" | "bio" | "avatar" | "handle") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: k === "handle" ? e.target.value.replace(/^@/, "").trim() : e.target.value }));
  const valid =
    f.name.trim().length > 0 && bytes(f.name) <= 48 && bytes(f.bio) <= 280 && bytes(f.avatar) <= 256 && bytes(f.handle) <= 32 && (!f.avatar || /^https:\/\//.test(f.avatar));

  async function submit() {
    const args = [f.name.trim(), f.bio.trim(), f.avatar.trim(), f.handle, BigInt(f.fid)] as const;
    const ok = await tx.send(
      [
        {
          label: existing ? "Update profile" : "Create profile",
          run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: existing ? "updateProfile" : "registerCreator", args }),
        },
      ],
      existing ? "Profile updated" : "You're live. Share your profile to get your first backer",
    );
    if (ok) onDone?.();
  }

  return (
    <div className={existing ? "" : "mx-auto max-w-4xl"}>
      {!existing && <PageTitle title="Set up your creator profile" sub={`Fans back you with USDC that stays theirs. You collect the yield. Your profile is stored on ${net.chain.name}`} />}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="surface flex flex-col gap-4 p-5">
          {mini.user && (
            <div className="flex items-center gap-3 rounded-[10px] bg-raised p-3 text-[14px]">
              <Avatar address={address ?? "0x0"} src={mini.user.pfpUrl} name={mini.user.displayName} size={28} />
              <span className="flex-1 text-fg-2">Using your Base App profile{mini.user.username ? ` @${mini.user.username}` : ""}</span>
              <button className="btn btn-quiet btn-sm" onClick={fromApp}>
                Refill
              </button>
            </div>
          )}
          <label className="flex flex-col gap-2 text-[14px]">
            <span className="text-fg-2">Name</span>
            <input className="input" maxLength={48} value={f.name} onChange={set("name")} placeholder="Nocturne Beats" />
          </label>
          <label className="flex flex-col gap-2 text-[14px]">
            <span className="flex justify-between text-fg-2">
              Bio <span className="num text-[12px] text-muted">{bytes(f.bio)}/280</span>
            </span>
            <textarea className="input min-h-24" value={f.bio} onChange={set("bio")} placeholder="What you make, and what backing helps you do" />
          </label>
          <label className="flex flex-col gap-2 text-[14px]">
            <span className="text-fg-2">Picture link, https</span>
            <input className="input" value={f.avatar} onChange={set("avatar")} placeholder="https://…" />
          </label>
          <label className="flex flex-col gap-2 text-[14px]">
            <span className="text-fg-2">Base App username</span>
            <input className="input" value={f.handle} onChange={set("handle")} placeholder="yourname" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={!valid || tx.state.status === "pending"} onClick={submit}>
              {existing ? "Save changes" : "Create profile"}
            </button>
            {onDone && (
              <button className="btn btn-quiet" onClick={onDone}>
                Cancel
              </button>
            )}
          </div>
          <TxStatus state={tx.state} />
        </div>
        <div>
          <div className="mb-2 text-[13px] text-fg-2">Preview</div>
          <div className="surface p-5">
            <div className="flex items-center gap-3">
              <Avatar address={address ?? "0x0"} src={f.avatar} name={f.name || "?"} size={44} />
              <div className="min-w-0">
                <div className="truncate font-medium">{f.name || "Your name"}</div>
                {f.handle && <div className="text-[13px] text-muted">@{f.handle}</div>}
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line text-[14px] text-fg-2">{f.bio || "Your bio shows here"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
