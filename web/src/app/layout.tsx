import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header, TabBar } from "@/components/Header";
import { NetBanner } from "@/components/NetBanner";
import { SITE_URL } from "@/lib/networks";
import { miniAppEmbed } from "@/lib/embed";

const title = "Backing";
const description = "Back creators with money you keep. Stake USDC on Base, the yield goes to them, and you can withdraw every cent any time.";

export const metadata: Metadata = {
  title: { default: "Backing: back creators with money you keep", template: "%s · Backing" },
  description,
  metadataBase: new URL(SITE_URL),
  openGraph: { title, description, type: "website", images: [{ url: "/card.png", width: 1200, height: 800 }] },
  twitter: { card: "summary_large_image", title, description, images: ["/card.png"] },
  icons: { icon: "/icon.svg", apple: "/icon-1024.png" },
  other: miniAppEmbed({ imageUrl: `${SITE_URL}/card.png`, title: "Open Backing", url: SITE_URL }),
};

export const viewport: Viewport = { themeColor: "#07080d", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          <Header />
          <NetBanner />
          <main className="mx-auto w-full max-w-6xl px-4 pb-40 pt-6 sm:px-6 sm:pt-8 md:pb-24">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-28 text-[12px] leading-relaxed text-muted sm:px-6 md:pb-10">
            Backing is experimental software built for Vibestarter Vibeathon 02. Principal sits in a third-party ERC-4626 vault and carries smart-contract and vault
            risk. Backers earn no return, the yield goes to creators. Not financial advice
          </footer>
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}
