"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { useState } from "react";
import { wagmiConfig } from "@/lib/wagmi";
import { NetProvider } from "@/lib/net";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 2_000 } } }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <NetProvider>{children}</NetProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
