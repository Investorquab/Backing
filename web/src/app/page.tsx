"use client";
import { useAccount } from "wagmi";
import { Feed } from "@/components/Feed";
import { Landing } from "@/components/Landing";
import { Skeleton } from "@/components/ui";

export default function Home() {
  const { status } = useAccount();
  if (status === "connected") return <Feed />;
  if (status === "reconnecting" || status === "connecting") return <Skeleton className="h-96" />;
  return <Landing />;
}
