import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { NetBanner } from "@/components/NetBanner";

const title = "Backing — your capital works the night shift";
const description =
  "Back creators without spending a cent. Stake USDC behind a creator on Base; the yield goes to them, your principal stays yours and you can withdraw any time.";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary", title, description },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0a0c16", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          <Header />
          <NetBanner />
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 sm:pt-8">{children}</main>
          <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs leading-relaxed text-dim">
            Backing is experimental software built for Vibestarter Vibeathon 02. Principal is deposited in a third-party
            ERC-4626 vault and is subject to smart-contract and vault risk. Backers don&apos;t earn returns; the yield goes to
            creators. Not financial advice.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
