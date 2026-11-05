"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Camera, Check, ImagePlus } from "lucide-react";
import { backingAbi } from "@/lib/abi";
import { useApr, useBackers, useCreator, useCreatorMap, useTx, type CreatorView } from "@/lib/hooks";
import { countdown, money, num, short, terms } from "@/lib/format";
import { useNet } from "@/lib/net";
import { useMiniApp } from "@/lib/miniapp";
import { useUpload } from "@/lib/upload";
import { safeImage } from "@/lib/images";
import { cleanHandle, linkCode, parseXPost, xIntent } from "@/lib/x";
import { useXVerified } from "@/lib/xhooks";
import { Avatar } from "@/components/Avatar";
import { Composer } from "@/components/Composer";
import { ShareRow } from "@/components/ShareRow";
import { PageHeader } from "@/components/Shell";
import { SignIn } from "@/components/SignIn";
import { TheBlock, tierOf } from "@/components/TheBlock";
import { WindowMark } from "@/components/WindowMark";
import { Verified, XGlyph } from "@/components/XBits";
import { LiveNumber, Skeleton, Stat, StatRow, TxStatus, useNow } from "@/components/ui";

const YEAR = 365 * 24 * 3600;
const bytes = (s: string) => new TextEncoder().encode(s).length;

export default function Studio() {
  const { address, isConnected } = useAccount();
  const { data: c, isLoading, missing } = useCreator(address);

  if (!isConnected)
    return (
      <>
        <PageHeader title="Studio" />
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <div className="text-[20px] font-medium">Get backed, not tipped</div>
          <p className="max-w-sm text-fg-2">Sign in with the wallet you want to be paid in. Fans stake USDC behind you and you collect the yield it earns</p>
          <SignIn big />
        </div>
      </>
    );
  if (isLoading)
    return (
      <>
        <PageHeader title="Studio" />
        <div className="p-4">
          <Skeleton className="h-64" />
        </div>
      </>
    );
  if (missing || !c)
    return (
      <>
        <PageHeader title="Set up your profile" sub="Fans back you with USDC that stays theirs. You collect the yield" />
        <ProfileEditor />
      </>
    );
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
    <>
      <PageHeader title="Studio" sub={c.name} />
      <section className="border-b border-[var(--line)] p-4">
        <div className="flex items-center gap-2 text-[13px] text-fg-2">
          <WindowMark size={12} /> Ready to claim
        </div>
        <LiveNumber className="mt-2 block text-[40px] font-medium leading-none text-lamp" value={num(c.claimable)} perSecond={(p * apr) / YEAR} at={dataUpdatedAt} />
        <div className="mt-4 flex flex-wrap items-center gap-3">
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
            {wait > 0 ? `Next claim in ${countdown(wait)}` : c.claimable > 0n ? "You can claim now" : "Nothing to claim yet"} · every {epoch}
          </span>
        </div>
        <TxStatus state={tx.state} />
      </section>

      <div className="p-4">
        <StatRow cols={4}>
          <Stat label="Backing">{money(p)}</Stat>
          <Stat label="Backers">{Number(c.backerCount)}</Stat>
          <Stat label="A month" note={`at ${Math.round(incomeApr * 100)}% a year`}>
            {money((p * incomeApr) / 12)}
          </Stat>
          <Stat label="Claimed">{money(num(c.totalClaimed))}</Stat>
        </StatRow>
      </div>

      <section id="write" className="border-y border-[var(--line)] px-4 py-3">
        <Composer />
      </section>

      <section className="border-b border-[var(--line)] p-4">
        <div className="flex items-start gap-4">
          <TheBlock className="w-[110px] shrink-0" cols={4} minRows={4} lit={(rows ?? []).map((r) => ({ key: r.backer, amount: num(r.principal) }))} />
          <div className="min-w-0">
            <div className="text-[15px] font-medium">Grow your block</div>
            <p className="mt-1 text-[14px] text-fg-2">Every $1,000 backed sends you about {money((1000 * incomeApr) / 12)} a month. Share your profile where your fans are</p>
            <div className="mt-3">
              <ShareRow address={c.creator} name={c.name} mine />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="px-4 pb-2 pt-4 text-[17px] font-medium">Your backers</h2>
        {!rows || rows.length === 0 ? (
          <p className="px-4 pb-6 text-fg-2">No backers yet. Share your profile to light the first window</p>
        ) : (
          <ul>
            {rows.map((r) => {
              const t = terms(r.endsAt, r.lockedUntil);
              return (
                <li key={r.backer} className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3 text-[14px]">
                  <Avatar address={r.backer} src={creators.get(r.backer.toLowerCase())?.avatar} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="num truncate">{creators.get(r.backer.toLowerCase())?.name ?? short(r.backer)}</div>
                    <div className="num text-[12px] text-muted">
                      {tierOf(num(r.principal)).name} · {t.label} · sent {money(num(r.generated))}
                    </div>
                  </div>
                  <span className="num">{money(num(r.principal))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="p-4">
        {editing ? (
          <ProfileEditor existing={c} onDone={() => setEditing(false)} />
        ) : (
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>
              Edit profile
            </button>
            <Link className="btn btn-quiet" href={`/c/${c.creator}`}>
              View profile
            </Link>
          </div>
        )}
      </section>
    </>
  );
}

type Form = { name: string; bio: string; avatar: string; banner: string; handle: string; fid: number; x: string; xPost: string };

function ProfileEditor({ existing, onDone }: { existing?: CreatorView; onDone?: () => void }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { address } = useAccount();
  const mini = useMiniApp();
  const tx = useTx();
  const up = useUpload();
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<Form>({ name: "", bio: "", avatar: "", banner: "", handle: "", fid: 0, x: "", xPost: "" });

  useEffect(() => {
    if (existing)
      setF({ name: existing.name, bio: existing.bio, avatar: existing.avatar, banner: existing.banner, handle: existing.handle, fid: Number(existing.fid), x: existing.x, xPost: existing.xPost });
  }, [existing]);

  // Inside Base App, start from the profile people already know there.
  useEffect(() => {
    const u = mini.user;
    if (existing || !u) return;
    setF((s) => ({
      ...s,
      name: s.name || (u.displayName || u.username || "").slice(0, 48),
      handle: u.username ?? s.handle,
      avatar: s.avatar || (u.pfpUrl && /^https:\/\//.test(u.pfpUrl) && bytes(u.pfpUrl) <= 256 ? u.pfpUrl : ""),
      fid: u.fid,
    }));
  }, [mini.user, existing]);

  const set = (k: "name" | "bio" | "handle") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: k === "handle" ? e.target.value.replace(/^@/, "").trim() : e.target.value }));

  async function pick(kind: "avatar" | "banner", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await up.upload(file);
    if (url) setF((s) => ({ ...s, [kind]: url }));
  }

  const valid =
    f.name.trim().length > 0 && bytes(f.name) <= 48 && bytes(f.bio) <= 280 && bytes(f.avatar) <= 256 && bytes(f.banner) <= 256 && bytes(f.handle) <= 32 && bytes(f.x) <= 32;

  async function submit() {
    const profile = { name: f.name.trim(), bio: f.bio.trim(), avatar: f.avatar, banner: f.banner, handle: f.handle, fid: BigInt(f.fid), x: f.x, xPost: f.xPost };
    const ok = await tx.send(
      [
        {
          label: existing ? "Save profile" : "Create profile",
          run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: existing ? "updateProfile" : "registerCreator", args: [profile] }),
        },
      ],
      existing ? "Profile saved" : "You're live. Share your profile to get your first backer",
    );
    if (ok) onDone?.();
  }

  const banner = safeImage(f.banner);
  return (
    <div className={existing ? "rounded-[14px] border border-[var(--line)]" : ""}>
      <div className="relative">
        <button
          className="group relative block aspect-[3/1] w-full overflow-hidden bg-deep"
          onClick={() => bannerRef.current?.click()}
          aria-label="Upload a banner"
          disabled={up.busy}
        >
          {banner && <img src={banner} alt="" className="h-full w-full object-cover" />}
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-fg opacity-90 transition-opacity group-hover:opacity-100">
            <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-[13px]">
              <ImagePlus size={16} strokeWidth={1.5} /> {banner ? "Change banner" : "Add a banner"}
            </span>
          </span>
        </button>
        <button
          className="group absolute -bottom-10 left-4 rounded-full border-4 border-bg"
          onClick={() => avatarRef.current?.click()}
          aria-label="Upload a profile picture"
          disabled={up.busy}
        >
          <Avatar address={address ?? "0x0"} src={f.avatar} name={f.name || "?"} size={88} />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-fg">
            <Camera size={20} strokeWidth={1.5} />
          </span>
        </button>
        <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => pick("avatar", e)} />
        <input ref={bannerRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => pick("banner", e)} />
      </div>
      <div className="flex flex-col gap-4 p-4 pt-14">
        {up.busy && <p className="text-[13px] text-fg-2">Uploading. Sign the message in your wallet</p>}
        {up.error && <p className="text-[13px] text-neg">{up.error}</p>}
        {mini.user && !existing && <p className="text-[13px] text-fg-2">Filled in from your Base App profile{mini.user.username ? ` @${mini.user.username}` : ""}. Change anything you like</p>}
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
        <XLink address={address!} x={f.x} xPost={f.xPost} onChange={(x, xPost) => setF((s) => ({ ...s, x, xPost }))} />
        <label className="flex flex-col gap-2 text-[14px]">
          <span className="text-fg-2">Base App username, optional</span>
          <input className="input" value={f.handle} onChange={set("handle")} placeholder="yourname" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={!valid || up.busy || tx.state.status === "pending"} onClick={submit}>
            {existing ? "Save profile" : "Create profile"}
          </button>
          {onDone && (
            <button className="btn btn-quiet" onClick={onDone}>
              Cancel
            </button>
          )}
        </div>
        <TxStatus state={tx.state} />
      </div>
    </div>
  );
}

/** Link an X account: post a short code from it, paste the post's link, and we check it. */
function XLink({ address, x, xPost, onChange }: { address: string; x: string; xPost: string; onChange: (x: string, xPost: string) => void }) {
  const code = linkCode(address);
  const [link, setLink] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const verified = useXVerified(x && xPost ? { creator: address as `0x${string}`, x, xPost } : undefined);

  async function check() {
    const p = parseXPost(link);
    if (!p) return setErr("Paste the link to your post, like https://x.com/you/status/123…");
    setChecking(true);
    setErr(null);
    try {
      const r = await fetch(`/api/x/verify?address=${address}&x=${p.handle}&post=${p.id}`);
      const j = (await r.json()) as { verified: boolean; reason?: string; handle?: string };
      if (j.verified) {
        onChange(cleanHandle(j.handle ?? p.handle), p.id);
        setLink("");
      } else setErr(j.reason ?? "Couldn't verify that post");
    } catch {
      setErr("Couldn't reach X right now. Try again in a minute");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="rounded-[12px] border border-[var(--line)] p-3 text-[14px]">
      <div className="flex items-center gap-2">
        <XGlyph size={14} />
        <span className="font-medium">X account</span>
        {x && (verified ? <Verified /> : null)}
        {x && <span className="text-fg-2">@{x}</span>}
        {x && (
          <button className="ml-auto text-[13px] text-muted hover:text-fg" onClick={() => onChange("", "")}>
            Remove
          </button>
        )}
      </div>
      {x && verified ? (
        <p className="mt-2 flex items-center gap-1.5 text-fg-2">
          <Check size={14} strokeWidth={1.5} className="text-pos" /> Linked. Save your profile to keep it
        </p>
      ) : (
        <ol className="mt-2 flex flex-col gap-2 text-fg-2">
          <li>
            1. Post your code from your X account:{" "}
            <a
              className="text-lamp hover:underline"
              target="_blank"
              rel="noreferrer"
              href={xIntent(`I'm on Backing: back me with USDC you keep, its yield supports my work. Code ${code}`)}
            >
              Post on X
            </a>
            <span className="num ml-2 rounded-[4px] bg-raised px-1.5 py-0.5 text-[12px] text-fg">{code}</span>
          </li>
          <li className="flex flex-col gap-2">
            <span>2. Paste the link to that post</span>
            <div className="flex gap-2">
              <input className="input h-10" placeholder="https://x.com/you/status/…" value={link} onChange={(e) => setLink(e.target.value.trim())} aria-label="Link to your X post" />
              <button className="btn btn-secondary h-10" onClick={check} disabled={!link || checking}>
                {checking ? "Checking" : "Verify"}
              </button>
            </div>
          </li>
          {err && <li className="text-neg">{err}</li>}
        </ol>
      )}
    </div>
  );
}
