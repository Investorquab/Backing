import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { TabBar, TopBar } from "@/components/Nav";
import { BackDialog } from "@/components/BackDialog";
import { ComposeDialog } from "@/components/Composer";
import { SITE_URL } from "@/lib/networks";
import { miniAppEmbed } from "@/lib/embed";

const description = "Back creators with money you keep. Stake USDC on Base: the yield goes to them, and you can take your money back any time.";

export const metadata: Metadata = {
  title: { default: "Backing: patronage that doesn't disappear", template: "%s · Backing" },
  description,
  metadataBase: new URL(SITE_URL),
  openGraph: { title: "Backing", description, type: "website", images: [{ url: "/card.png", width: 1200, height: 800 }] },
  twitter: { card: "summary_large_image", title: "Backing", description, images: ["/card.png"] },
  icons: { icon: "/icon.svg", apple: "/icon-1024.png" },
  other: miniAppEmbed({ imageUrl: `${SITE_URL}/card.png`, title: "Open Backing", url: SITE_URL }),
};

export const viewport: Viewport = { themeColor: "#0b0d14", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          <TopBar />
          <main className="mx-auto w-full max-w-[680px] px-4 pb-32 pt-6 md:pb-16">{children}</main>
          <TabBar />
          <BackDialog />
          <ComposeDialog />
        </Providers>
      </body>
    </html>
  );
}
