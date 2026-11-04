"use client";
import { useState } from "react";
import { Link2, Share } from "lucide-react";
import { useNet } from "@/lib/net";
import { useMiniApp } from "@/lib/miniapp";

export function profileUrl(address: string, netKey: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/c/${address}?net=${netKey}`;
}

/** In Base App: cast it to the feed. On the web: native share sheet or copy link. */
export function ShareRow({ address, name, mine = false, text }: { address: string; name: string; mine?: boolean; text?: string }) {
  const { net } = useNet();
  const mini = useMiniApp();
  const [copied, setCopied] = useState(false);
  const url = profileUrl(address, net.key);
  const message =
    text ?? (mine ? "Back me on Backing. Your USDC stays yours, the yield it earns supports my work" : `I'm backing ${name} on Backing. My USDC stays mine, the yield goes to them. Back them too`);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Back ${name}`, text: message, url });
        return;
      } catch {}
    }
    await copy();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {mini.inMiniApp ? (
        <button className="btn btn-secondary btn-sm" onClick={() => mini.composeCast(message, url)}>
          <Share size={16} strokeWidth={1.5} /> {mine ? "Cast my profile" : "Cast this"}
        </button>
      ) : (
        <button className="btn btn-secondary btn-sm" onClick={share}>
          <Share size={16} strokeWidth={1.5} /> Share
        </button>
      )}
      <button className="btn btn-quiet btn-sm" onClick={copy}>
        <Link2 size={16} strokeWidth={1.5} /> {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
