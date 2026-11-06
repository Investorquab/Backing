"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { keccak256, toBytes } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { Camera, Check } from "lucide-react";
import { backingAbi } from "@/lib/abi";
import { useProfile, useTx, ZERO } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { useMiniApp } from "@/lib/miniapp";
import { useUpload } from "@/lib/upload";
import { farcasterHandleFromLink, useFarcaster } from "@/lib/farcaster";
import { isUsername } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { FarcasterConnect } from "@/components/FarcasterConnect";
import { SignIn } from "@/components/SignIn";
import { Skeleton, TxStatus } from "@/components/ui";

const bytes = (s: string) => new TextEncoder().encode(s).length;
type Form = { username: string; baseName: string; avatar: string; bio: string; link: string };

export default function EditProfile() {
  const { address, isConnected } = useAccount();
  const { data: me, isLoading } = useProfile(address);
  if (!isConnected)
    return (
      <div className="surface flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="text-[20px] font-medium">Connect a wallet to make your profile</div>
        <SignIn big />
      </div>
    );
  if (isLoading) return <Skeleton className="h-96" />;
  return <Editor key={me?.account ?? "new"} existing={me?.profile} />;
}

function Editor({ existing }: { existing?: Form }) {
  const { net } = useNet();
  const d = net.deployment!;
  const router = useRouter();
  const { address } = useAccount();
  const mini = useMiniApp();
  const tx = useTx();
  const up = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<Form>(existing ?? { username: "", baseName: "", avatar: "", bio: "", link: "" });

  // In Base App, start from the profile people already know there.
  useEffect(() => {
    const u = mini.user;
    if (existing || !u) return;
    setF((s) => ({
      ...s,
      username: s.username || (u.username ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20),
      avatar: s.avatar || (u.pfpUrl && /^https:\/\//.test(u.pfpUrl) && bytes(u.pfpUrl) <= 256 ? u.pfpUrl : ""),
    }));
  }, [mini.user, existing]);

  // If this wallet is on Farcaster, prefill a new profile from it so onboarding is one step.
  const fc = useFarcaster(address);
  useEffect(() => {
    const u = fc.data;
    if (existing || !u) return;
    setF((s) => ({
      ...s,
      username: s.username || u.username.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20),
      bio: s.bio || u.bio.slice(0, 280),
      link: s.link || `https://farcaster.xyz/${u.username}`,
    }));
  }, [fc.data, existing]);

  const owner = useReadContract({
    chainId: net.chain.id,
    address: d.backing,
    abi: backingAbi,
    functionName: "usernameOwner",
    args: [keccak256(toBytes(f.username))],
    query: { enabled: isUsername(f.username) },
  });
  const takenBy = owner.data as `0x${string}` | undefined;
  const taken = !!takenBy && takenBy !== ZERO && takenBy.toLowerCase() !== address?.toLowerCase();
  const linkOk = !f.link || (/^https:\/\/\S+$/.test(f.link) && bytes(f.link) <= 120);
  const valid = isUsername(f.username) && !taken && bytes(f.baseName) <= 64 && bytes(f.bio) <= 280 && linkOk && bytes(f.avatar) <= 256 && !up.busy;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await up.upload(file);
    if (url) setF((s) => ({ ...s, avatar: url }));
  }

  async function save() {
    const ok = await tx.send(
      [{ label: existing ? "Save profile" : "Create profile", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "saveProfile", args: [f] }) }],
      existing ? "Saved" : "Your profile is live",
    );
    if (ok) router.push(`/u/${f.username}`);
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: k === "username" ? e.target.value.toLowerCase().replace(/^@/, "").replace(/\s/g, "") : k === "link" || k === "baseName" ? e.target.value.trim() : e.target.value }));

  // The profile's single link field holds the creator's Farcaster handle (as a farcaster.xyz URL).
  const fcHandle = farcasterHandleFromLink(f.link) ?? "";
  const setFcHandle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = e.target.value.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_.-]/g, "").slice(0, 32);
    setF((s) => ({ ...s, link: h ? `https://farcaster.xyz/${h}` : "" }));
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[22px] font-medium">{existing ? "Edit profile" : "Create your profile"}</h1>
      {!existing && <p className="-mt-2 text-fg-2">Your profile lets you post and be backed. It lives on {net.chain.name}, tied to your wallet</p>}
      <div className="surface flex flex-col gap-5 p-5">
        <div className="flex items-center gap-4">
          <button className="group relative rounded-full" onClick={() => fileRef.current?.click()} disabled={up.busy} aria-label="Upload a picture">
            <Avatar address={address ?? "0x0"} src={f.avatar} name={f.username || "?"} size={88} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-fg">
              <Camera size={20} strokeWidth={1.5} />
            </span>
          </button>
          <div className="text-[14px] text-fg-2">
            <button className="text-lamp hover:underline" onClick={() => fileRef.current?.click()} disabled={up.busy}>
              {up.busy ? "Uploading. Sign the message in your wallet" : f.avatar ? "Change picture" : "Add a picture"}
            </button>
            {up.error && <p className="mt-1 text-neg">{up.error}</p>}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={pick} />
        </div>

        <label className="flex flex-col gap-2 text-[14px]">
          <span className="text-fg-2">Username</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">@</span>
            <input className="input pl-7" value={f.username} onChange={set("username")} placeholder="yourname" maxLength={20} autoCapitalize="none" />
          </div>
          <span className={`text-[12px] ${taken || (f.username && !isUsername(f.username)) ? "text-neg" : "text-muted"}`}>
            {taken ? (
              "Taken. Try another"
            ) : f.username && !isUsername(f.username) ? (
              "3 to 20 characters: lowercase letters, numbers and _"
            ) : isUsername(f.username) && owner.isSuccess ? (
              <span className="inline-flex items-center gap-1 text-pos">
                <Check size={13} strokeWidth={2} /> Available
              </span>
            ) : isUsername(f.username) ? (
              "Checking…"
            ) : (
              "3 to 20 characters: lowercase letters, numbers and _"
            )}
          </span>
        </label>
        <label className="flex flex-col gap-2 text-[14px]">
          <span className="text-fg-2">Base username, optional</span>
          <input className="input" value={f.baseName} onChange={set("baseName")} placeholder="yourname.base.eth" />
        </label>
        <label className="flex flex-col gap-2 text-[14px]">
          <span className="flex justify-between text-fg-2">
            Bio <span className="num text-[12px] text-muted">{bytes(f.bio)}/280</span>
          </span>
          <textarea className="input min-h-24" value={f.bio} onChange={set("bio")} placeholder="What you make, and what backing helps you do" />
        </label>
        <label className="flex flex-col gap-2 text-[14px]">
          <span className="text-fg-2">Farcaster username, optional</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">@</span>
            <input className="input pl-7" value={fcHandle} onChange={setFcHandle} placeholder="yourhandle" autoCapitalize="none" />
          </div>
          <span className="text-[12px] text-muted">Shows your Farcaster posts on your profile, and lets fans find and back you by your handle</span>
        </label>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-lg px-6" disabled={!valid || tx.state.status === "pending"} onClick={save}>
            {existing ? "Save" : "Create profile"}
          </button>
          {existing && (
            <button className="btn btn-quiet btn-lg" onClick={() => router.back()}>
              Cancel
            </button>
          )}
        </div>
        <TxStatus state={tx.state} />
      </div>
      <FarcasterConnect handle={fcHandle} />
    </div>
  );
}
