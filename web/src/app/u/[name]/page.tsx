import type { Metadata } from "next";
import { isAddress } from "viem";
import { ProfilePage } from "./ProfilePage";
import { NETWORKS, SITE_URL, netFromParam } from "@/lib/networks";
import { miniAppEmbed } from "@/lib/embed";
import { backingAbi } from "@/lib/abi";
import { clientFor } from "@/lib/server";

type Props = { params: Promise<{ name: string }>; searchParams: Promise<{ net?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { name } = await params;
  const key = netFromParam((await searchParams).net);
  const d = NETWORKS[key].deployment;
  let address = isAddress(name) ? name : "";
  if (d && !address) {
    try {
      const p = (await clientFor(key).readContract({ address: d.backing, abi: backingAbi, functionName: "getProfileByUsername", args: [name] })) as { account: string; joinedAt: bigint };
      if (p.joinedAt > 0n) address = p.account;
    } catch {}
  }
  const image = address ? `${SITE_URL}/api/card?c=${address}&net=${key}` : `${SITE_URL}/card.png`;
  const url = `${SITE_URL}/u/${name}`;
  return {
    title: isAddress(name) ? "Profile" : `@${name}`,
    description: `Back @${name} on Backing. Your USDC stays yours, its yield goes to them.`,
    openGraph: { images: [{ url: image, width: 1200, height: 800 }] },
    twitter: { card: "summary_large_image", images: [image] },
    other: miniAppEmbed({ imageUrl: image, title: "Back them", url }),
  };
}

export default function Page() {
  return <ProfilePage />;
}
