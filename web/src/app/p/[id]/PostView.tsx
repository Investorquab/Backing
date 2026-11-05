"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { backingAbi } from "@/lib/abi";
import { useBackers, useComments, useCreatorMap, usePositions, usePost, useTx } from "@/lib/hooks";
import { ago, money, num, short } from "@/lib/format";
import { useNet } from "@/lib/net";
import { Avatar } from "@/components/Avatar";
import { AuthorLine, PostActions, PostBody } from "@/components/PostCard";
import { PageHeader } from "@/components/Shell";
import { SignIn } from "@/components/SignIn";
import { WindowMark } from "@/components/WindowMark";
import { Skeleton, TxStatus } from "@/components/ui";

export function PostView() {
  const { id } = useParams<{ id: string }>();
  const postId = /^\d+$/.test(id) ? BigInt(id) : undefined;
  const { address } = useAccount();
  const { data: p, isLoading, isError } = usePost(postId);
  const { data: comments } = useComments(postId);
  const creators = useCreatorMap();
  const { rows } = useBackers(p?.creator);
  const { data: mine } = usePositions(address);
  const backers = useMemo(() => new Set((rows ?? []).map((r) => r.backer.toLowerCase())), [rows]);
  const iBack = !!p && (mine ?? []).some((x) => x.principal > 0n && x.creator.toLowerCase() === p.creator.toLowerCase());
  const c = p ? creators.get(p.creator.toLowerCase()) : undefined;

  return (
    <>
      <PageHeader title="Post" back />
      {isLoading ? (
        <div className="p-4">
          <Skeleton className="h-48" />
        </div>
      ) : !p || isError ? (
        <p className="px-8 py-16 text-center text-fg-2">This post doesn&apos;t exist on this network</p>
      ) : (
        <>
          <article className="border-b border-[var(--line)] px-4 pt-3">
            <div className="flex items-center gap-3">
              <Link href={`/c/${p.creator}`}>
                <Avatar address={p.creator} src={c?.avatar} name={c?.name} size={44} />
              </Link>
              <AuthorLine c={c} address={p.creator} />
            </div>
            <div className="mt-3">
              <PostBody p={p} big />
            </div>
            <div className="mt-4 text-[14px] text-muted">
              {new Date(p.time * 1000).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="mt-3 flex gap-5 border-t border-[var(--line)] py-3 text-[14px]">
              <span>
                <span className="num font-medium">{money(num(p.stats.backed))}</span> <span className="text-muted">backed from this post</span>
              </span>
              <span>
                <span className="num font-medium">{p.stats.backings}</span> <span className="text-muted">backing{p.stats.backings === 1 ? "" : "s"}</span>
              </span>
            </div>
            <div className="border-t border-[var(--line)] pb-1">
              <PostActions p={p} creator={c} iBack={iBack} />
            </div>
          </article>

          <CommentBox postId={p.id} />

          {(comments ?? []).map((m) => {
            const mc = creators.get(m.actor.toLowerCase());
            const isBacker = backers.has(m.actor.toLowerCase());
            const isAuthor = m.actor.toLowerCase() === p.creator.toLowerCase();
            return (
              <div key={m.id.toString()} className="flex gap-3 border-b border-[var(--line)] px-4 py-3">
                <Avatar address={m.actor} src={mc?.avatar} name={mc?.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5 text-[15px]">
                    {mc ? (
                      <Link href={`/c/${m.actor}`} className="truncate font-medium hover:underline">
                        {mc.name}
                      </Link>
                    ) : (
                      <span className="num truncate font-medium">{short(m.actor)}</span>
                    )}
                    {isAuthor && <span className="text-[12px] text-muted">Author</span>}
                    {isBacker && (
                      <span className="inline-flex items-center gap-1 text-[12px] text-lamp" title="Backs this creator">
                        <WindowMark size={11} /> Backer
                      </span>
                    )}
                    <span className="text-muted">·</span>
                    <span className="shrink-0 text-muted">{ago(m.time)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-line break-words text-[15px]">{m.text}</p>
                </div>
              </div>
            );
          })}
          {comments && comments.length === 0 && <p className="px-8 py-10 text-center text-fg-2">No comments yet. Start the conversation</p>}
        </>
      )}
    </>
  );
}

function CommentBox({ postId }: { postId: bigint }) {
  const { net } = useNet();
  const d = net.deployment!;
  const { address, isConnected } = useAccount();
  const tx = useTx();
  const [text, setText] = useState("");
  const n = new TextEncoder().encode(text).length;
  if (!isConnected)
    return (
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-4 text-[15px] text-fg-2">
        Sign in to comment
        <SignIn />
      </div>
    );
  return (
    <div className="flex gap-3 border-b border-[var(--line)] px-4 py-3">
      <Avatar address={address!} size={40} />
      <div className="min-w-0 flex-1">
        <label htmlFor="reply" className="sr-only">
          Comment
        </label>
        <textarea
          id="reply"
          className="min-h-[52px] w-full resize-none bg-transparent pt-2 text-[17px] outline-none placeholder:text-muted"
          placeholder="Post your comment"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center justify-end gap-3">
          <span className={`num text-[12px] ${n > 280 ? "text-neg" : "text-muted"}`}>{280 - n}</span>
          <button
            className="btn btn-primary btn-sm px-4"
            disabled={!text.trim() || n > 280 || tx.state.status === "pending"}
            onClick={async () => {
              const ok = await tx.send(
                [{ label: "Comment", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.backing, abi: backingAbi, functionName: "comment", args: [postId, text.trim()] }) }],
                "Comment posted",
              );
              if (ok) setText("");
            }}
          >
            Reply
          </button>
        </div>
        <TxStatus state={tx.state} />
      </div>
    </div>
  );
}
