"use client";
import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useNet } from "./net";

/** Shrinks a picture in the browser (max 1600px, WebP) so uploads are small and fast. GIFs pass through. */
async function shrink(file: File, max = 1600): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read that picture"))), "image/webp", 0.86));
}

/** Upload a picture: your wallet signs a short message so the server knows it's you. */
export function useUpload() {
  const { address } = useAccount();
  const { net } = useNet();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<string | null> {
    if (!address) {
      setError("Sign in first");
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await shrink(file);
      if (blob.size > 4 * 1024 * 1024) throw new Error("That picture is over 4 MB even after shrinking");
      const message = `Backing upload\naddress: ${address}\ntime: ${Math.floor(Date.now() / 1000)}`;
      const signature = await signMessageAsync({ message });
      const form = new FormData();
      form.set("file", blob, blob.type === "image/gif" ? "upload.gif" : "upload.webp");
      form.set("address", address);
      form.set("message", message);
      form.set("signature", signature);
      form.set("net", net.key);
      const r = await fetch("/api/upload", { method: "POST", body: form });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "Upload failed");
      return j.url;
    } catch (e) {
      const m = (e as Error).message || "Upload failed";
      setError(/rejected|denied/i.test(m) ? "Cancelled in your wallet" : m);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { upload, busy, error };
}
