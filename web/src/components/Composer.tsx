"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRef, useState } from "react";
import { useAccount } from "wagmi";
import { ImagePlus, X } from "lucide-react";
import { backingAbi } from "@/lib/abi";
import { useProfile, useTx } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { useUpload } from "@/lib/upload";
import { useUi } from "@/lib/ui-state";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import { TxStatus } from "./ui";

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Write a post: text and/or a picture. */
export function Composer({ onPosted, autoFocus = false, bare = false }: { onPosted?: () => void; autoFocus?: boolean; bare?: boolean }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { address } = useAccount();
  const { data: me } = useProfile(address);
  const tx = useTx();
  const up = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const n = bytes(text);
  const valid = (text.trim().length > 0 || !!image) && n <= 280 && !up.busy;

  if (!address) return null;
  if (!me)
    return (
      <div className="surface flex items-center justify-between gap-3 p-4 text-[15px] text-fg-2">
        Create your profile to post and get backed
        <Link href="/profile/edit" className="btn btn-primary btn-sm px-4">
          Create profile
        </Link>
      </div>
    );

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = await up.upload(f);
    if (url) setImage(url);
  }

  async function submit() {
    const ok = await tx.send(
      [{ label: "Post", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "post", args: [text.trim(), image ?? ""] }) }],
      "Posted",
    );
    if (ok) {
      setText("");
      setImage(null);
      onPosted?.();
    }
  }

  return (
    <div className={bare ? "" : "surface p-4"}>
      <div className="flex gap-3">
        <Avatar address={me.account} src={me.profile.avatar} name={me.profile.username} size={40} />
        <label className="sr-only" htmlFor="compose">
          New post
        </label>
        <textarea
          id="compose"
          autoFocus={autoFocus}
          className="min-h-[72px] flex-1 resize-none bg-transparent pt-2 text-[17px] leading-[1.45] outline-none placeholder:text-muted"
          placeholder="Share what you're working on"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {image && (
        <div className="relative mt-3 overflow-hidden rounded-[12px] border border-[var(--line)]">
          <img src={image} alt="Attached picture" className="max-h-[360px] w-full object-cover" />
          <button className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70" onClick={() => setImage(null)} aria-label="Remove picture">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}
      {up.error && <p className="mt-2 text-[13px] text-neg">{up.error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={pick} />
        <button className="btn btn-quiet btn-sm text-lamp" onClick={() => fileRef.current?.click()} disabled={up.busy}>
          <ImagePlus size={17} strokeWidth={1.5} /> {up.busy ? "Uploading" : "Picture"}
        </button>
        <span className={`num ml-auto text-[12px] ${n > 280 ? "text-neg" : "text-muted"}`}>{280 - n}</span>
        <button className="btn btn-primary btn-sm px-5" disabled={!valid || tx.state.status === "pending"} onClick={submit}>
          Post
        </button>
      </div>
      <TxStatus state={tx.state} />
    </div>
  );
}

export function ComposeDialog() {
  const ui = useUi();
  return (
    <Modal open={ui.composeOpen} onClose={ui.closeCompose} title="New post" wide>
      <Composer autoFocus bare onPosted={ui.closeCompose} />
    </Modal>
  );
}
