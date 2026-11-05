import type { Metadata } from "next";
import { PostView } from "./PostView";
import { NETWORKS, SITE_URL, netFromParam } from "@/lib/networks";
import { miniAppEmbed } from "@/lib/embed";
import { backingAbi } from "@/lib/abi";
import { clientFor } from "@/lib/server";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ net?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { net } = await searchParams;
  const key = netFromParam(net);
  const url = `${SITE_URL}/p/${id}?net=${key}`;
  let image = `${SITE_URL}/card.png`;
  let text = "";
  const d = NETWORKS[key].deployment;
  if (d && /^\d+$/.test(id)) {
    try {
      const [a] = (await clientFor(key).readContract({ address: d.backing, abi: backingAbi, functionName: "getPost", args: [BigInt(id)] })) as unknown as [
        { creator: string; text: string },
      ];
      image = `${SITE_URL}/api/card?c=${a.creator}&net=${key}`;
      text = a.text;
    } catch {}
  }
  return {
    title: text ? text.slice(0, 60) : "Post",
    description: text || undefined,
    openGraph: { images: [{ url: image, width: 1200, height: 800 }] },
    twitter: { card: "summary_large_image", images: [image] },
    other: miniAppEmbed({ imageUrl: image, title: "Back them", url }),
  };
}

export default function Page() {
  return <PostView />;
}
