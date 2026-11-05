import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { MobileTopBar, RightRail, Sidebar, TabBar } from "@/components/Shell";
import { BackDialog } from "@/components/BackDialog";
import { ComposeDialog } from "@/components/Composer";
import { SITE_URL } from "@/lib/networks";
import { miniAppEmbed } from "@/lib/embed";

const title = "Backing";
const description = "Back creators with money you keep. Stake USDC on Base, the yield goes to them, and you can withdraw every cent.";

export const metadata: Metadata = {
  title: { default: "Backing: back creators with money you keep", template: "%s · Backing" },
  description,
  metadataBase: new URL(SITE_URL),
  openGraph: { title, description, type: "website", images: [{ url: "/card.png", width: 1200, height: 800 }] },
  twitter: { card: "summary_large_image", title, description, images: ["/card.png"] },
  icons: { icon: "/icon.svg", apple: "/icon-1024.png" },
  other: miniAppEmbed({ imageUrl: `${SITE_URL}/card.png`, title: "Open Backing", url: SITE_URL }),
};

export const viewport: Viewport = { themeColor: "#0b0d14", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          <MobileTopBar />
          <div className="mx-auto flex w-full max-w-[1280px] justify-center">
            <Sidebar />
            <main className="min-h-dvh w-full min-w-0 max-w-[600px] border-[var(--line)] pb-32 md:border-x md:pb-16">{children}</main>
            <RightRail />
          </div>
          <TabBar />
          <BackDialog />
          <ComposeDialog />
        </Providers>
      </body>
    </html>
  );
}
