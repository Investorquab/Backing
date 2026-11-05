"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { useState } from "react";
import { wagmiConfig } from "@/lib/wagmi";
import { NetProvider } from "@/lib/net";
import { MiniAppProvider } from "@/lib/miniapp";
import { UiProvider } from "@/lib/ui-state";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 2_000 } } }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <MiniAppProvider>
          <NetProvider>
            <UiProvider>{children}</UiProvider>
          </NetProvider>
        </MiniAppProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
