"use client";
import { useState } from "react";
import { useNet } from "@/lib/net";

export function profileUrl(address: string, netKey: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/c/${address}?net=${netKey}`;
}

export function ShareRow({ address, name, text }: { address: string; name: string; text?: string }) {
  const { net } = useNet();
  const [copied, setCopied] = useState(false);
  const url = profileUrl(address, net.key);
  const tweet =
    text ??
    `I'm backing ${name} on Backing: my USDC stays mine, the yield it earns goes to them. Back them too 👇`;
  const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(url)}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Back ${name}`, text: tweet, url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn btn-ghost px-4 py-2 text-sm" onClick={share}>
        {copied ? "Link copied" : "Share link"}
      </button>
      <a className="btn btn-ghost px-4 py-2 text-sm" href={xUrl} target="_blank" rel="noreferrer">
        Post on X
      </a>
    </div>
  );
}
