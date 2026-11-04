import type { Metadata } from "next";
import { isAddress } from "viem";
import { CreatorProfile } from "./CreatorProfile";
import { SITE_URL, netFromParam } from "@/lib/networks";
import { miniAppEmbed } from "@/lib/embed";

type Props = { params: Promise<{ address: string }>; searchParams: Promise<{ net?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { address } = await params;
  const { net } = await searchParams;
  if (!isAddress(address)) return {};
  const key = netFromParam(net);
  const url = `${SITE_URL}/c/${address}?net=${key}`;
  const image = `${SITE_URL}/api/card?c=${address}&net=${key}`;
  return {
    title: "Back this creator on Backing",
    openGraph: { images: [{ url: image, width: 1200, height: 800 }] },
    twitter: { card: "summary_large_image", images: [image] },
    other: miniAppEmbed({ imageUrl: image, title: "Back them", url }),
  };
}

export default function Page() {
  return <CreatorProfile />;
}
