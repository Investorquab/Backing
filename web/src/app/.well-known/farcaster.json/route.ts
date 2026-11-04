import { SITE_URL } from "@/lib/networks";

/**
 * The mini app manifest Base App reads at /.well-known/farcaster.json.
 * accountAssociation proves you own this domain. You get the three values by signing
 * your domain with your Base App / Farcaster account (see README, "Base App setup"),
 * then paste them into Vercel env vars. Nothing secret here: they are public signatures.
 */
export const dynamic = "force-dynamic";

export function buildManifest() {
  const site = SITE_URL;
  const manifest: Record<string, unknown> = {
    accountAssociation: {
      header: process.env.FARCASTER_HEADER || "",
      payload: process.env.FARCASTER_PAYLOAD || "",
      signature: process.env.FARCASTER_SIGNATURE || "",
    },
    miniapp: {
      version: "1",
      name: "Backing",
      iconUrl: `${site}/icon-1024.png`,
      homeUrl: site,
      imageUrl: `${site}/card.png`,
      buttonTitle: "Open Backing",
      splashImageUrl: `${site}/splash.png`,
      splashBackgroundColor: "#0b0d14",
      subtitle: "Back creators, keep your USDC",
      description:
        "Stake USDC behind creators you believe in. It earns yield on Base, the yield goes to them, and you can withdraw every cent any time.",
      primaryCategory: "social",
      tags: ["creators", "patronage", "usdc", "base", "yield"],
      tagline: "Your capital works nights",
      heroImageUrl: `${site}/card.png`,
      ogTitle: "Backing",
      ogDescription: "Back creators with money you keep. The yield goes to them, your USDC stays yours.",
      ogImageUrl: `${site}/card.png`,
      noindex: process.env.MINIAPP_NOINDEX === "true",
    },
  };
  // Some Base tooling asks for the wallet that owns the listing. Only added if you set it.
  if (process.env.BASE_BUILDER_OWNER) manifest.baseBuilder = { ownerAddress: process.env.BASE_BUILDER_OWNER };
  return manifest;
}

export function GET() {
  return Response.json(buildManifest(), { headers: { "Cache-Control": "public, max-age=300" } });
}
