"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Link2, Share } from "lucide-react";
import { useMiniApp } from "@/lib/miniapp";
import { inviteLink, xIntent } from "@/lib/invite";

function XGlyph() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.18h1.7L7.4 4.73H5.58l11.09 14.45Z" />
    </svg>
  );
}

/**
 * "Back them too": share a creator's profile with your invite code on it. When someone backs
 * through your link, it's recorded on-chain that you brought them.
 */
export function Invite({ username, text, url: customUrl }: { username: string; text: string; url?: string }) {
  const { address } = useAccount();
  const mini = useMiniApp();
  const [copied, setCopied] = useState(false);
  const url = customUrl ?? inviteLink(username, address);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {mini.inMiniApp ? (
        <button className="btn btn-secondary btn-sm" onClick={() => mini.composeCast(text, url)}>
          <Share size={15} strokeWidth={1.5} /> Cast it
        </button>
      ) : (
        <a className="btn btn-secondary btn-sm" href={xIntent(text, url)} target="_blank" rel="noreferrer">
          <XGlyph /> Share on X
        </a>
      )}
      <button className="btn btn-quiet btn-sm" onClick={copy}>
        <Link2 size={15} strokeWidth={1.5} /> {copied ? "Link copied" : "Copy invite link"}
      </button>
    </div>
  );
}
