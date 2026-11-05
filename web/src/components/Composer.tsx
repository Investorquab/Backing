"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { useAccount } from "wagmi";
import { ImagePlus, Link2, X } from "lucide-react";
import { backingAbi } from "@/lib/abi";
import { useCreator, useTx } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { useMiniApp } from "@/lib/miniapp";
import { useUpload } from "@/lib/upload";
import { useUi } from "@/lib/ui-state";
import { parseXPost, xIntent } from "@/lib/x";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import { TxStatus } from "./ui";
import { XGlyph } from "./XBits";

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Write a post: text, a picture, and a link (paste one of your X posts to show it here). */
export function Composer({ onPosted, autoFocus = false }: { onPosted?: () => void; autoFocus?: boolean }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { address } = useAccount();
  const { data: me } = useCreator(address);
  const mini = useMiniApp();
  const tx = useTx();
  const up = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [posted, setPosted] = useState<{ text: string; id?: string } | null>(null);

  const n = bytes(text);
  const linkOk = !link || (/^https:\/\/\S+$/.test(link) && bytes(link) <= 256);
  const valid = (text.trim().length > 0 || !!image || !!link) && n <= 280 && linkOk && !up.busy;
  if (!me) return null;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = await up.upload(f);
    if (url) setImage(url);
  }

  async function submit() {
    const body = text.trim();
    const ok = await tx.send(
      [
        {
          label: "Post",
          run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "post", args: [body, link.trim(), image ?? ""] }),
        },
      ],
      "Posted",
    );
    if (ok) {
      setPosted({ text: body });
      setText("");
      setLink("");
      setImage(null);
      setShowLink(false);
      onPosted?.();
    }
  }

  const profile = typeof window !== "undefined" ? `${window.location.origin}/c/${me.creator}?net=${net.key}` : "";
  const xp = parseXPost(link);

  return (
    <div className="flex gap-3">
      <Avatar address={me.creator} src={me.avatar} name={me.name} size={40} />
      <div className="min-w-0 flex-1">
        <label htmlFor="compose" className="sr-only">
          Post
        </label>
        <textarea
          id="compose"
          autoFocus={autoFocus}
          className="min-h-[88px] w-full resize-none bg-transparent pt-2 text-[19px] leading-[1.4] outline-none placeholder:text-muted"
          placeholder="What are you making tonight?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {image && (
          <div className="relative mt-2 overflow-hidden rounded-[16px] border border-[var(--line)]">
            <img src={image} alt="Attached picture" className="max-h-[360px] w-full object-cover" />
            <button className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-fg" onClick={() => setImage(null)} aria-label="Remove picture">
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}
        {showLink && (
          <div className="mt-2">
            <input className="input" placeholder="Paste one of your X posts, or any https link" value={link} onChange={(e) => setLink(e.target.value.trim())} aria-label="Link" autoFocus />
            {xp && <p className="mt-1 text-[12px] text-muted">Shows as a post from @{xp.handle} on X</p>}
            {!linkOk && <p className="mt-1 text-[13px] text-neg">Links start with https://</p>}
          </div>
        )}
        {up.error && <p className="mt-2 text-[13px] text-neg">{up.error}</p>}
        <div className="mt-3 flex items-center gap-1 border-t border-[var(--line)] pt-3">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={pick} />
          <button className="btn btn-quiet btn-sm w-9 px-0 text-lamp" onClick={() => fileRef.current?.click()} disabled={up.busy} aria-label="Add a picture" title="Add a picture">
            <ImagePlus size={18} strokeWidth={1.5} />
          </button>
          <button className="btn btn-quiet btn-sm w-9 px-0 text-lamp" onClick={() => setShowLink((s) => !s)} aria-label="Add a link or X post" title="Add a link or one of your X posts">
            <Link2 size={18} strokeWidth={1.5} />
          </button>
          {up.busy && <span className="text-[13px] text-muted">Uploading. Sign in your wallet</span>}
          <span className={`num ml-auto mr-3 text-[12px] ${n > 280 ? "text-neg" : "text-muted"}`}>{280 - n}</span>
          <button className="btn btn-primary btn-sm px-4" disabled={!valid || tx.state.status === "pending"} onClick={submit}>
            Post
          </button>
        </div>
        <TxStatus state={tx.state} />
        {posted && tx.state.status === "success" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {mini.inMiniApp ? (
              <button className="btn btn-secondary btn-sm" onClick={() => mini.composeCast(posted.text, profile)}>
                Also cast it
              </button>
            ) : (
              <a className="btn btn-secondary btn-sm" href={xIntent(posted.text ? `${posted.text}\n\nBack me on Backing:` : "Back me on Backing:", profile)} target="_blank" rel="noreferrer">
                <XGlyph size={13} /> Also post on X
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ComposeDialog() {
  const ui = useUi();
  return (
    <Modal open={ui.composeOpen} onClose={ui.closeCompose} title="New post" wide>
      <Composer autoFocus />
    </Modal>
  );
}
